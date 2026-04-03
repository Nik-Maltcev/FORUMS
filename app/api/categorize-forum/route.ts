import { NextRequest, NextResponse } from "next/server"

interface CategorizeResult {
  category: string
  confidence: "высокая" | "средняя" | "низкая"
  description: string
  error?: string
}

function extractPageMeta(html: string): string {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern)
    return m ? (m[1] || "").trim().slice(0, 300) : ""
  }

  const title = get(/<title[^>]*>([^<]{1,300})<\/title>/i)
  const description =
    get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,300})["']/i) ||
    get(/<meta[^>]*content=["']([^"']{1,300})["'][^>]*name=["']description["']/i)
  const keywords =
    get(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']{1,300})["']/i) ||
    get(/<meta[^>]*content=["']([^"']{1,300})["'][^>]*name=["']keywords["']/i)

  // Extract headings h1-h3
  const headings: string[] = []
  const hPattern = /<h[1-3][^>]*>([^<]{2,100})<\/h[1-3]>/gi
  let m: RegExpExecArray | null
  while ((m = hPattern.exec(html)) !== null && headings.length < 10) {
    const text = m[1].trim()
    if (text) headings.push(text)
  }

  // Extract forum section/category names
  const sectionNames: string[] = []
  const sectionPatterns = [
    // Container with class -> child link/span
    /class="[^"]*(?:forum[-_]?title|board[-_]?name|category[-_]?name|node[-_]?title|forumtitle)[^"]*"[^>]*>[\s\S]{0,5}<(?:a|span|div)[^>]*>([^<]{2,80})/gi,
    // phpBB: forumtitle class directly on <a>
    /<a[^>]*class="[^"]*forumtitle[^"]*"[^>]*>([^<]{2,80})<\/a>/gi,
    // XenForo: node-title -> <a>
    /class="[^"]*node-title[^"]*"[^>]*>\s*<a[^>]*>([^<]{2,80})<\/a>/gi,
    // IPB: ipsDataItem_title -> <a>
    /ipsDataItem_title[^>]*>\s*<a[^>]*>([^<]{2,80})<\/a>/gi,
  ]
  for (const pattern of sectionPatterns) {
    let sm: RegExpExecArray | null
    while ((sm = pattern.exec(html)) !== null && sectionNames.length < 20) {
      const text = sm[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim()
      if (text && !sectionNames.includes(text)) sectionNames.push(text)
    }
  }

  const parts = [
    title && `Заголовок: ${title}`,
    description && `Описание: ${description}`,
    keywords && `Ключевые слова: ${keywords}`,
    headings.length > 0 && `Заголовки страницы: ${headings.join(" | ")}`,
    sectionNames.length > 0 && `Разделы форума: ${sectionNames.join(" | ")}`,
  ].filter(Boolean)

  return parts.join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const { url, apiKey, lang = "ru" } = await request.json()

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })
    if (!apiKey) return NextResponse.json({ error: "Gemini API key is required" }, { status: 400 })

    // Per-language config
    // Accept-Language per country, categories always in Russian
    const acceptLangs: Record<string, string> = {
      ru: "ru,en;q=0.5",
      en: "en,en-US;q=0.9",
      de: "de,en;q=0.5",
      fr: "fr,en;q=0.5",
      es: "es,en;q=0.5",
      it: "it,en;q=0.5",
      cs: "cs,en;q=0.5",
      nl: "nl,en;q=0.5",
      tr: "tr,en;q=0.5",
    }

    const acceptLang = acceptLangs[lang] || acceptLangs.ru
    const categories = "Инвестиции | Путешествия/туризм | Торговля | Авто | Психология/отношения | Ставки/казино | Бизнес/карьера | Образование | Политика | Новости | Другое"

    // Fetch forum HTML
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let html = ""
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": acceptLang,
        },
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e) {
      clearTimeout(timeout)
      const msg = e instanceof Error ? e.message : "Не удалось загрузить"
      return NextResponse.json({ error: msg } as CategorizeResult, { status: 400 })
    }

    const meta = extractPageMeta(html)
    if (!meta) {
      return NextResponse.json({
        category: "Не определено",
        confidence: "низкая",
        description: "Не удалось извлечь данные со страницы",
      } as CategorizeResult)
    }

    // Call Kimi K2.5 (OpenAI-compatible API)
    const prompt = `Ты эксперт по классификации интернет-форумов. На основе данных ниже определи тематическую категорию форума.

Данные форума:
${meta}

Категории (используй ТОЛЬКО одну из них, ТОЧНО как написано):
${categories}

Правила:
- Выбери ОДНУ категорию из списка выше — ту которая лучше всего подходит
- Если форум не подходит ни под одну конкретную категорию — используй "Другое"
- Никогда не придумывай свои категории — только из списка
- Никогда не возвращай несколько категорий, только одну
- Отвечай ТОЛЬКО на русском языке

Ответь строго в формате JSON (без markdown, без пояснений):
{
  "category": "название категории ТОЧНО из списка",
  "confidence": "высокая" | "средняя" | "низкая",
  "description": "одно предложение — почему такая категория"
}`

    // Call Kimi (OpenAI-compatible API) with retry on 429
    const callKimi = async (attempt = 0): Promise<Response> => {
      const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "kimi-k2-0905-preview",
          messages: [{ role: "user", content: prompt }],
          thinking: { type: "disabled" },
          max_tokens: 256,
        }),
      })
      if (res.status === 429 && attempt < 5) {
        const wait = Math.max(2, attempt + 1) * 1000
        await new Promise(r => setTimeout(r, wait))
        return callKimi(attempt + 1)
      }
      return res
    }

    const kimiRes = await callKimi()

    if (!kimiRes.ok) {
      const err = await kimiRes.text()
      return NextResponse.json({ error: `Kimi error: ${kimiRes.status} ${err.slice(0, 200)}` }, { status: 500 })
    }

    const kimiData = await kimiRes.json()
    const text = kimiData?.choices?.[0]?.message?.content ?? ""

    // Strip markdown code fences and extract JSON object
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "")
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: `Не удалось разобрать ответ Kimi: ${text.slice(0, 200)}` },
        { status: 500 }
      )
    }

    const result: CategorizeResult = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
