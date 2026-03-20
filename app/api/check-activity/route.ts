import { NextRequest, NextResponse } from "next/server"

interface PostData {
  title?: string
  author?: string
  date?: string
  preview?: string
  replies?: string
  views?: string
}

interface ActivityResult {
  activityLevel: "высокая" | "средняя" | "низкая" | "мёртвый"
  postsPerWeek: string
  uniqueAuthors: string
  contentQuality: string
  dateSpread: string
  verdict: string
  error?: string
}

function extractPosts(html: string): PostData[] {
  const posts: PostData[] = []

  // Strip scripts/styles to reduce noise
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")

  // Strategy 1: Table rows with thread/topic links (phpBB, SMF, vBulletin, IPB, XenForo)
  const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  const rows = clean.match(rowPattern) || []

  for (const row of rows) {
    if (posts.length >= 20) break

    // Must contain a link to a topic/thread
    const hasTopicLink = /(?:viewtopic|showtopic|showthread|threads?\/|topic\/|\/t\/|viewforum)/i.test(row)
    const hasTopicClass = /class="[^"]*(?:topic|thread|subject|forumtitle)[^"]*"/i.test(row)
    if (!hasTopicLink && !hasTopicClass) continue

    const post: PostData = {}

    // Title from link
    const titleMatch = row.match(/<a[^>]*(?:viewtopic|showtopic|showthread|threads?\/|topic\/)[^>]*>([^<]{2,120})<\/a>/i)
      || row.match(/<a[^>]*class="[^"]*(?:topic|thread|subject)[^"]*"[^>]*>([^<]{2,120})<\/a>/i)
    if (titleMatch) post.title = titleMatch[1].trim()

    // Author
    const authorMatch = row.match(/class="[^"]*(?:author|username|user[-_]?name|poster|lastposter)[^"]*"[^>]*>(?:<[^>]*>)*([^<]{2,40})/i)
      || row.match(/(?:by|автор|от)\s*<a[^>]*>([^<]{2,40})<\/a>/i)
    if (authorMatch) post.author = authorMatch[1].trim()

    // Date
    const dateMatch = row.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)
      || row.match(/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{2,4})/i)
      || row.match(/((?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\S*\s+\d{1,2},?\s*\d{2,4})/i)
      || row.match(/(сегодня|вчера|today|yesterday|heute|gestern)[\s,]*\d{1,2}:\d{2}/i)
      || row.match(/(\d+\s*(?:минут|час|дн|hour|minute|day)\S*\s*(?:назад|ago))/i)
    if (dateMatch) post.date = dateMatch[1].trim()

    // Replies/views counters
    const numbers = row.match(/>(\d[\d,.]*)<\/(?:td|span|div|dd)/gi) || []
    const nums = numbers.map(n => n.replace(/<[^>]*>/g, "").trim()).filter(n => /^\d/.test(n))
    if (nums.length >= 2) {
      post.replies = nums[0]
      post.views = nums[1]
    } else if (nums.length === 1) {
      post.replies = nums[0]
    }

    if (post.title || post.date) {
      posts.push(post)
    }
  }

  // Strategy 2: Div-based layouts (XenForo 2, Discourse, modern forums)
  if (posts.length < 5) {
    const divPattern = /<(?:div|li|article)[^>]*class="[^"]*(?:structItem|topic-list-item|discussion|thread-row|cTopicList|ipsDataItem)[^"]*"[^>]*>[\s\S]*?<\/(?:div|li|article)>/gi
    const divBlocks = clean.match(divPattern) || []

    for (const block of divBlocks) {
      if (posts.length >= 20) break
      const post: PostData = {}

      const titleMatch = block.match(/<a[^>]*>([^<]{2,120})<\/a>/i)
      if (titleMatch) post.title = titleMatch[1].trim()

      const authorMatch = block.match(/class="[^"]*(?:username|author|poster)[^"]*"[^>]*>(?:<[^>]*>)*([^<]{2,40})/i)
      if (authorMatch) post.author = authorMatch[1].trim()

      const dateMatch = block.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/)
        || block.match(/<time[^>]*>([^<]{2,60})<\/time>/i)
        || block.match(/datetime="([^"]+)"/i)
      if (dateMatch) post.date = dateMatch[1].trim()

      if (post.title || post.date) {
        posts.push(post)
      }
    }
  }

  // Strategy 3: Fallback — grab any topic-like links with nearby dates
  if (posts.length < 3) {
    const linkPattern = /<a[^>]*href="[^"]*(?:viewtopic|showthread|showtopic|threads?\/|topic\/|\/t\/)[^"]*"[^>]*>([^<]{2,120})<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = linkPattern.exec(clean)) !== null && posts.length < 20) {
      const title = m[1].trim()
      if (title && !posts.some(p => p.title === title)) {
        posts.push({ title })
      }
    }
  }

  return posts
}

function extractTextSnippets(html: string): string[] {
  const snippets: string[] = []
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")

  // Look for post preview/snippet text
  const previewPattern = /class="[^"]*(?:preview|snippet|lastpost|last[-_]?post|message[-_]?text|post[-_]?body)[^"]*"[^>]*>([\s\S]{10,300}?)<\//gi
  let m: RegExpExecArray | null
  while ((m = previewPattern.exec(clean)) !== null && snippets.length < 10) {
    const text = m[1].replace(/<[^>]*>/g, "").trim()
    if (text.length > 10) snippets.push(text.slice(0, 200))
  }

  return snippets
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
      return NextResponse.json({ error: msg } as ActivityResult, { status: 400 })
    }

    const posts = extractPosts(html)
    const snippets = extractTextSnippets(html)

    if (posts.length === 0 && snippets.length === 0) {
      return NextResponse.json({
        activityLevel: "мёртвый",
        postsPerWeek: "0",
        uniqueAuthors: "0",
        contentQuality: "Не удалось извлечь данные о постах",
        dateSpread: "нет данных",
        verdict: "Не удалось найти посты на странице. Возможно, это не форум или структура нестандартная.",
      } as ActivityResult)
    }

    // Build context for Gemini
    const postsText = posts.map((p, i) => {
      const parts = [`${i + 1}.`]
      if (p.title) parts.push(`Тема: ${p.title}`)
      if (p.author) parts.push(`Автор: ${p.author}`)
      if (p.date) parts.push(`Дата: ${p.date}`)
      if (p.replies) parts.push(`Ответов: ${p.replies}`)
      if (p.views) parts.push(`Просмотров: ${p.views}`)
      return parts.join(" | ")
    }).join("\n")

    const snippetsText = snippets.length > 0
      ? `\n\nПревью последних сообщений:\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : ""

    const prompt = `Ты эксперт по анализу интернет-форумов. Проанализируй данные о последних постах форума и оцени его РЕАЛЬНУЮ активность.

Сегодняшняя дата: ${new Date().toISOString().slice(0, 10)}

URL форума: ${url}

Последние темы/посты (до 20 штук):
${postsText}
${snippetsText}

КРИТИЧЕСКИ ВАЖНО — анализ дат:
- Внимательно посмотри на ДАТЫ каждого поста
- Определи за какой период эти посты: все за последнюю неделю? за месяц? за несколько лет?
- Если 20 постов растянуты на 3-5 лет — это мёртвый форум, даже если постов "много"
- Если посты только за последние дни/недели — форум живой
- Пример: 20 постов за 2020-2026 = ~3 поста в год = мёртвый. 20 постов за март 2026 = живой.
- "сегодня"/"вчера"/"X минут назад" = свежая активность

Оцени:
1. Уровень активности — люди реально общаются или форум заброшен?
2. Примерная частота постов (в неделю) — считай по датам, не по количеству
3. Сколько уникальных авторов видно
4. Качество контента — реальные обсуждения, спам, или автоматические посты?
5. Разброс дат — за какой период собраны посты (например "2020-2026" или "последняя неделя")
6. Общий вердикт — стоит ли этот форум внимания как площадка с живой аудиторией?

Правила:
- Если дат нет или они старые — форум скорее всего мёртвый
- Если один автор пишет всё — это не живой форум
- Если темы выглядят как спам или SEO — отметь это
- Главный критерий — ЧАСТОТА постов, а не их количество
- Будь честным и конкретным

Ответь строго в формате JSON (без markdown, без пояснений):
{
  "activityLevel": "высокая" | "средняя" | "низкая" | "мёртвый",
  "postsPerWeek": "примерное число или диапазон, основанное на датах",
  "uniqueAuthors": "примерное число или оценка",
  "contentQuality": "краткая оценка качества контента",
  "dateSpread": "за какой период посты, например: 2020-2026 (6 лет) или последние 3 дня",
  "verdict": "2-3 предложения — общий вывод о форуме"
}`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return NextResponse.json({ error: `Gemini error: ${geminiRes.status} ${err.slice(0, 200)}` }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: { text?: string }) => p.text ?? "").join("")

    const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "")
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: `Не удалось разобрать ответ Gemini: ${text.slice(0, 200)}` },
        { status: 500 }
      )
    }

    const result: ActivityResult = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
