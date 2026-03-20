import { NextRequest, NextResponse } from "next/server"

interface TopicInfo {
  title: string
  replies: number
  lastPostDate?: string
  lastPostTimestamp?: number
}

interface SectionInfo {
  name: string
  url: string
  topics: TopicInfo[]
}

interface ActivityResult {
  totalTopics: number
  totalReplies: number
  topicsLast30Days: number
  repliesLast30Days: number
  topicsLast7Days: number
  repliesLast7Days: number
  sectionsScanned: number
  sections: SectionInfo[]
  error?: string
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru,en;q=0.9",
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

function parseDate(raw: string): number | undefined {
  const s = raw.trim().toLowerCase()

  if (/^(сегодня|today|heute|aujourd'hui|hoy|oggi|dzisiaj|vandaag|bugün|idag|tänään)/.test(s)) return NOW
  if (/^(вчера|yesterday|gestern|hier|ayer|ieri|wczoraj|gisteren|dün|igår|eilen)/.test(s)) return NOW - DAY

  const agoMatch = s.match(/^(\d+)\s*(минут|час|дн|день|дня|дней|секунд|second|minute|hour|day|week|month|stunde|tag|woche|heure|jour|semaine|hora|día|semana|minut|godzin|dzień|tydzień|saat|gün|hafta|perc|óra|nap|hét)\w*/i)
  if (agoMatch) {
    const n = parseInt(agoMatch[1], 10)
    const unit = agoMatch[2].toLowerCase()
    if (/^(секунд|second)/.test(unit)) return NOW - n * 1000
    if (/^(минут|minute|minut)/.test(unit)) return NOW - n * 60 * 1000
    if (/^(час|hour|stunde|heure|hora|godzin|saat|óra)/.test(unit)) return NOW - n * 60 * 60 * 1000
    if (/^(дн|день|дня|дней|day|tag|jour|día|dzień|gün|nap)/.test(unit)) return NOW - n * DAY
    if (/^(week|woche|semaine|semana|tydzień|hafta|hét)/.test(unit)) return NOW - n * 7 * DAY
    if (/^(month)/.test(unit)) return NOW - n * 30 * DAY
    return NOW - n * DAY
  }

  // ISO: 2026-03-17
  const isoMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])
    if (!isNaN(d.getTime())) return d.getTime()
  }

  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (dmy) {
    const d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1])
    if (!isNaN(d.getTime())) return d.getTime()
  }

  // DD.MM.YY
  const dmy2 = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2})(?!\d)/)
  if (dmy2) {
    const year = +dmy2[3] + (+dmy2[3] > 50 ? 1900 : 2000)
    const d = new Date(year, +dmy2[2] - 1, +dmy2[1])
    if (!isNaN(d.getTime())) return d.getTime()
  }

  // English months
  const enMonths: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
  const enMatch = s.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[,.\s]+(\d{4})/i)
    || s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})[,.\s]+(\d{4})/i)
  if (enMatch) {
    const groups = enMatch.slice(1)
    let day: number, mon: number, year: number
    if (/^\d+$/.test(groups[0])) {
      day = +groups[0]; mon = enMonths[groups[1].slice(0, 3).toLowerCase()]; year = +groups[2]
    } else {
      mon = enMonths[groups[0].slice(0, 3).toLowerCase()]; day = +groups[1]; year = +groups[2]
    }
    if (mon !== undefined) {
      const d = new Date(year, mon, day)
      if (!isNaN(d.getTime())) return d.getTime()
    }
  }

  // Russian months
  const ruMonths: Record<string, number> = {}
  const ruNames = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"]
  ruNames.forEach((n, i) => { ruMonths[n] = i })
  const ruMatch = s.match(/(\d{1,2})\s+(январ\S*|феврал\S*|март\S*|апрел\S*|ма[йя]\S*|июн\S*|июл\S*|август\S*|сентябр\S*|октябр\S*|ноябр\S*|декабр\S*)[,.\s]*(\d{4})?/i)
  if (ruMatch) {
    const day = +ruMatch[1]
    const monStr = ruMatch[2].toLowerCase()
    const year = ruMatch[3] ? +ruMatch[3] : new Date().getFullYear()
    const monKey = Object.keys(ruMonths).find(k => monStr.startsWith(k))
    if (monKey !== undefined) {
      const d = new Date(year, ruMonths[monKey], day)
      if (!isNaN(d.getTime())) return d.getTime()
    }
  }

  return undefined
}

function extractDateFromBlock(block: string): { dateStr?: string; timestamp?: number } {
  // datetime attributes first
  const dtAttr = block.match(/datetime="([^"]+)"/i)
  if (dtAttr) {
    const ts = parseDate(dtAttr[1])
    if (ts) return { dateStr: dtAttr[1], timestamp: ts }
  }

  // Relative dates
  const relPatterns = [
    /(сегодня|вчера|today|yesterday|heute|gestern|aujourd'hui|hier|hoy|ayer|oggi|ieri)[\s,]*\d{0,2}:?\d{0,2}/i,
    /(\d+\s*(?:минут|час|дн|день|дня|дней|секунд|second|minute|hour|day|week)\S*\s*(?:назад|ago|vor|il y a|hace|fa|temu))/i,
  ]
  for (const p of relPatterns) {
    const m = block.match(p)
    if (m) {
      const ts = parseDate(m[0])
      if (ts) return { dateStr: m[0].trim(), timestamp: ts }
    }
  }

  // Explicit dates
  const datePatterns = [
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[,.\s]+\d{4})/i,
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}[,.\s]+\d{4})/i,
    /(\d{1,2}\s+(?:январ\S*|феврал\S*|март\S*|апрел\S*|ма[йя]\S*|июн\S*|июл\S*|август\S*|сентябр\S*|октябр\S*|ноябр\S*|декабр\S*)[,.\s]*\d{0,4})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2})(?!\d)/,
  ]
  for (const p of datePatterns) {
    const m = block.match(p)
    if (m) {
      const ts = parseDate(m[1])
      if (ts) return { dateStr: m[1].trim(), timestamp: ts }
    }
  }

  return {}
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

function extractSectionLinks(html: string, baseUrl: string): { name: string; url: string }[] {
  const sections: { name: string; url: string }[] = []
  const seen = new Set<string>()

  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")

  // Strategy 1: XenForo node-title links
  const xfPattern = /class="[^"]*node-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = xfPattern.exec(clean)) !== null && sections.length < 15) {
    const href = m[1], name = m[2].trim()
    if (!name) continue
    const fullUrl = resolveUrl(baseUrl, href)
    if (seen.has(fullUrl)) continue
    if (/(?:threads\/\d|\/t\/\d)/i.test(fullUrl)) continue
    seen.add(fullUrl)
    sections.push({ name, url: fullUrl })
  }

  // Strategy 2: Generic forum section links
  const patterns = [
    /class="[^"]*(?:forumtitle|forum[-_]?name|board[-_]?name|forumlink)[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi,
    /<a[^>]*class="[^"]*(?:forumtitle|forum[-_]?name|board[-_]?name|forumlink)[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi,
    /<a[^>]*href="([^"]*(?:forums?\/[^"]*|board\/[^"]*|forumdisplay[^"]*|viewforum[^"]*))"\s[^>]*>([^<]{2,80})<\/a>/gi,
  ]

  for (const pattern of patterns) {
    while ((m = pattern.exec(clean)) !== null && sections.length < 15) {
      const href = m[1], name = m[2].trim()
      if (!name || name.length < 2) continue
      const fullUrl = resolveUrl(baseUrl, href)
      if (seen.has(fullUrl)) continue
      if (/(?:viewtopic|showthread|showtopic|threads\/\d|\/t\/\d)/i.test(fullUrl)) continue
      seen.add(fullUrl)
      sections.push({ name, url: fullUrl })
    }
  }

  return sections
}

function parseCount(raw: string): number {
  // "205" -> 205, "14 тыс." -> 14000, "1.2K" -> 1200, "24,500" -> 24500
  const s = raw.trim().replace(/\s/g, "")
  if (/тыс|k$/i.test(s)) {
    const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."))
    return Math.round(n * 1000)
  }
  if (/млн|m$/i.test(s)) {
    const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."))
    return Math.round(n * 1000000)
  }
  return parseInt(s.replace(/[,.']/g, ""), 10) || 0
}

function extractTopicsFromSection(html: string): TopicInfo[] {
  const topics: TopicInfo[] = []
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")

  // ── Strategy 1: XenForo structItem ──
  // Split by structItem boundaries instead of trying to match nested divs
  const structParts = clean.split(/(?=<div[^>]*class="[^"]*structItem\b[^"]*structItem--thread)/)
  for (const part of structParts) {
    if (topics.length >= 100) break
    if (!part.includes("structItem--thread")) continue

    // Take only up to the next structItem or a reasonable chunk
    const chunk = part.slice(0, 5000)

    // Title — link inside structItem-title
    const titleMatch = chunk.match(/structItem-title[\s\S]{0,500}?<a[^>]*href="[^"]*threads\/[^"]*"[^>]*>([\s\S]{2,200}?)<\/a>/i)
    if (!titleMatch) continue
    const title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").trim()
    if (!title || title.length < 2) continue

    // Replies — <dt>Ответы</dt><dd>205</dd> or <dt>Replies</dt><dd>205</dd>
    let replies = 0
    const pairsMatch = chunk.match(/<dt>\s*(?:Ответ|Repli|Posts|Сообщени|Antwort|Réponse|Respuesta|Odpowied|Rispost)\w*\s*<\/dt>\s*<dd>\s*([\d\s.,тысkKmMмлн]+)\s*<\/dd>/i)
    if (pairsMatch) {
      replies = parseCount(pairsMatch[1])
    }

    // Date — prefer structItem-latestDate or structItem-cell--latest
    let dateInfo: { dateStr?: string; timestamp?: number } = {}
    const latestBlock = chunk.match(/structItem-cell--latest([\s\S]{0,800})/i)
      || chunk.match(/structItem-latestDate([\s\S]{0,400})/i)
    if (latestBlock) {
      dateInfo = extractDateFromBlock(latestBlock[1])
    }
    if (!dateInfo.timestamp) {
      dateInfo = extractDateFromBlock(chunk)
    }

    topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
  }

  // ── Strategy 2: Table rows (phpBB, SMF, vBulletin) ──
  if (topics.length === 0) {
    const rowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi
    const rows = clean.match(rowPattern) || []

    for (const row of rows) {
      if (topics.length >= 100) break
      const hasTopicLink = /(?:viewtopic|showtopic|showthread|threads?\/\d|topic\/\d|\/t\/\d)/i.test(row)
      const hasTopicClass = /class="[^"]*(?:topictitle|threadtitle|topic[-_]?title|thread[-_]?title|subject)[^"]*"/i.test(row)
      if (!hasTopicLink && !hasTopicClass) continue

      const titleMatch = row.match(/<a[^>]*(?:viewtopic|showtopic|showthread|threads?\/\d|topic\/\d|\/t\/\d)[^>]*>([^<]{2,150})<\/a>/i)
        || row.match(/<a[^>]*class="[^"]*(?:topictitle|threadtitle|topic[-_]?title|thread[-_]?title|subject)[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = titleMatch[1].trim()

      let replies = 0
      // dl/dd pairs (some table-based forums also use this)
      const dlMatch = row.match(/<dt>\s*(?:Ответ|Repli|Posts|Сообщени)\w*\s*<\/dt>\s*<dd>\s*([\d\s.,тысkKmMмлн]+)\s*<\/dd>/i)
      if (dlMatch) {
        replies = parseCount(dlMatch[1])
      } else {
        const replyClassMatch = row.match(/class="[^"]*(?:repli|posts|answer|ответ|сообщени)[^"]*"[^>]*>[\s]*(\d[\d,.'тысkK]*)/i)
        if (replyClassMatch) {
          replies = parseCount(replyClassMatch[1])
        } else {
          const tdNums = row.match(/<td[^>]*>\s*(\d[\d,.']*)\s*<\/td>/gi) || []
          const nums = tdNums.map(td => {
            const n = td.match(/(\d[\d,.']*)/)?.[1]
            return n ? parseInt(n.replace(/[,.']/g, ""), 10) : 0
          }).filter(n => n > 0)
          if (nums.length >= 1) replies = nums[0]
        }
      }

      const lastPostBlock = row.match(/class="[^"]*(?:last[-_]?post|lastpost|latest|last_post)[^"]*"[^>]*>([\s\S]{0,500})/i)
      let dateInfo: { dateStr?: string; timestamp?: number }
      if (lastPostBlock) {
        dateInfo = extractDateFromBlock(lastPostBlock[1])
      } else {
        dateInfo = extractDateFromBlock(row)
      }

      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  // ── Strategy 3: IPB / Discourse / generic div-based ──
  if (topics.length === 0) {
    const divParts = clean.split(/(?=<(?:div|li|article)[^>]*class="[^"]*(?:ipsDataItem|topic-list-item|discussion|thread-row|cTopicList))/)
    for (const part of divParts) {
      if (topics.length >= 100) break
      if (!/ipsDataItem|topic-list-item|discussion|thread-row|cTopicList/i.test(part.slice(0, 200))) continue
      const chunk = part.slice(0, 5000)

      const titleMatch = chunk.match(/<a[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = titleMatch[1].trim()
      if (topics.some(t => t.title === title)) continue

      let replies = 0
      const dlMatch = chunk.match(/<dt>\s*(?:Ответ|Repli|Posts|Сообщени)\w*\s*<\/dt>\s*<dd>\s*([\d\s.,тысkKmMмлн]+)\s*<\/dd>/i)
      if (dlMatch) {
        replies = parseCount(dlMatch[1])
      } else {
        const replyMatch = chunk.match(/(?:repli|posts|answer|ответ|сообщени)\S*[:\s]*(\d[\d,.'тысkK]*)/i)
        if (replyMatch) replies = parseCount(replyMatch[1])
      }

      const dateInfo = extractDateFromBlock(chunk)
      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  return topics
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

    // Step 1: Fetch main page
    let mainHtml: string
    try {
      mainHtml = await fetchPage(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить"
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Step 2: Find section links
    const sectionLinks = extractSectionLinks(mainHtml, url)

    // Step 3: Also try to extract topics from main page directly (some forums show topics on main)
    const mainTopics = extractTopicsFromSection(mainHtml)

    const sections: SectionInfo[] = []

    if (mainTopics.length > 0) {
      sections.push({ name: "Главная", url, topics: mainTopics })
    }

    // Step 4: Crawl sections (limit to 10 to avoid abuse)
    const sectionsToScan = sectionLinks.slice(0, 10)
    for (const section of sectionsToScan) {
      try {
        const html = await fetchPage(section.url)
        const topics = extractTopicsFromSection(html)
        if (topics.length > 0) {
          sections.push({ name: section.name, url: section.url, topics })
        }
      } catch {
        // Skip failed sections
      }
    }

    // Step 5: Aggregate
    const thirtyDaysAgo = NOW - 30 * DAY
    const sevenDaysAgo = NOW - 7 * DAY

    let totalTopics = 0
    let totalReplies = 0
    let topicsLast30 = 0
    let repliesLast30 = 0
    let topicsLast7 = 0
    let repliesLast7 = 0

    // Deduplicate topics by title across sections
    const seenTitles = new Set<string>()

    for (const section of sections) {
      for (const topic of section.topics) {
        const key = topic.title.toLowerCase()
        if (seenTitles.has(key)) continue
        seenTitles.add(key)

        totalTopics++
        totalReplies += topic.replies

        if (topic.lastPostTimestamp && topic.lastPostTimestamp >= thirtyDaysAgo) {
          topicsLast30++
          repliesLast30 += topic.replies
        }
        if (topic.lastPostTimestamp && topic.lastPostTimestamp >= sevenDaysAgo) {
          topicsLast7++
          repliesLast7 += topic.replies
        }
      }
    }

    // Clean sections for response (limit topic details to save bandwidth)
    const cleanSections = sections.map(s => ({
      name: s.name,
      url: s.url,
      topics: s.topics.slice(0, 20).map(t => ({
        title: t.title,
        replies: t.replies,
        lastPostDate: t.lastPostDate,
      })),
    }))

    const result: ActivityResult = {
      totalTopics,
      totalReplies,
      topicsLast30Days: topicsLast30,
      repliesLast30Days: repliesLast30,
      topicsLast7Days: topicsLast7,
      repliesLast7Days: repliesLast7,
      sectionsScanned: sections.length,
      sections: cleanSections as SectionInfo[],
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
