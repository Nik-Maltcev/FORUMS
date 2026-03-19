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
  const sectionPattern = /class="[^"]*(?:forum[-_]?title|board[-_]?name|category[-_]?name|node[-_]?title|forumtitle)[^"]*"[^>]*>[\s\S]{0,5}<(?:a|span|div)[^>]*>([^<]{2,80})</gi
  while ((m = sectionPattern.exec(html)) !== null && sectionNames.length < 15) {
    const text = m[1].trim()
    if (text) sectionNames.push(text)
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
    const { url, apiKey } = await request.json()

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })
    if (!apiKey) return NextResponse.json({ error: "Gemini API key is required" }, { status: 400 })

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
          "Accept-Language": "ru,en;q=0.9",
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

    // Call Gemini Flash
    const prompt = `Ты эксперт по классификации интернет-форумов. На основе данных ниже определи тематическую категорию форума.

Данные форума:
${meta}

Ответь строго в формате JSON (без markdown, без пояснений):
{
  "category": "название категории на русском (одно-два слова, например: Авто, Сад и огород, Материнство, Путешествия, IT и технологии, Здоровье, Спорт, Кулинария, Животные, Недвижимость, Финансы, Образование, Игры, Мода и красота, Общение, Бизнес, Религия, Политика, Наука, Музыка, Кино, Спорт, Охота и рыбалка, Строительство, Юридические вопросы, Другое)",
  "confidence": "высокая" | "средняя" | "низкая",
  "description": "одно предложение — почему такая категория"
}`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return NextResponse.json({ error: `Gemini error: ${geminiRes.status} ${err.slice(0, 200)}` }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    // Collect all text parts (thinking models may split into multiple parts)
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: { text?: string }) => p.text ?? "").join("")

    // Strip markdown code fences and extract JSON object
    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "")
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: `Не удалось разобрать ответ Gemini: ${text.slice(0, 200)}` },
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
