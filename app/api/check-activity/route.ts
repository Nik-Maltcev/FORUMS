import { NextRequest, NextResponse } from "next/server"

// ── Types ──

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
  engine: string
  totalTopics: number
  totalReplies: number
  topicsThisYear: number
  repliesThisYear: number
  topicsLast30Days: number
  repliesLast30Days: number
  topicsLast7Days: number
  repliesLast7Days: number
  sectionsScanned: number
  sections: SectionInfo[]
  error?: string
}

type Lang = "ru" | "en" | "de" | "fr" | "es" | "it" | "cs" | "nl" | "tr"

// ── Language config ──

const LANG_CONFIG: Record<Lang, {
  acceptLang: string
  today: string[]
  yesterday: string[]
  months: Record<string, number>
  replyWords: string[]
  agoWord: string[]
  timeUnits: Record<string, string[]>
}> = {
  ru: {
    acceptLang: "ru,en;q=0.5",
    today: ["сегодня"],
    yesterday: ["вчера"],
    months: { "январ": 0, "феврал": 1, "март": 2, "апрел": 3, "ма": 4, "июн": 5, "июл": 6, "август": 7, "сентябр": 8, "октябр": 9, "ноябр": 10, "декабр": 11 },
    replyWords: ["Ответы", "Ответов", "Сообщений", "Сообщения"],
    agoWord: ["назад"],
    timeUnits: { sec: ["секунд"], min: ["минут"], hour: ["час"], day: ["дн", "день", "дня", "дней"], week: ["недел"], month: ["месяц"] },
  },
  en: {
    acceptLang: "en,en-US;q=0.9",
    today: ["today"],
    yesterday: ["yesterday"],
    months: { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 },
    replyWords: ["Replies", "Posts", "Messages"],
    agoWord: ["ago"],
    timeUnits: { sec: ["second"], min: ["minute"], hour: ["hour"], day: ["day"], week: ["week"], month: ["month"] },
  },
  de: {
    acceptLang: "de,en;q=0.5",
    today: ["heute"],
    yesterday: ["gestern"],
    months: { jan: 0, feb: 1, "mär": 2, mar: 2, apr: 3, mai: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dez: 11 },
    replyWords: ["Antworten", "Beiträge", "Nachrichten"],
    agoWord: ["vor"],
    timeUnits: { sec: ["Sekunde"], min: ["Minute"], hour: ["Stunde"], day: ["Tag"], week: ["Woche"], month: ["Monat"] },
  },
  fr: {
    acceptLang: "fr,en;q=0.5",
    today: ["aujourd'hui", "aujourd\u2019hui"],
    yesterday: ["hier"],
    months: { jan: 0, "fév": 1, fev: 1, mar: 2, avr: 3, mai: 4, jun: 5, jui: 6, "aoû": 7, aou: 7, sep: 8, oct: 9, nov: 10, "déc": 11, dec: 11 },
    replyWords: ["Réponses", "Messages", "Reponses"],
    agoWord: ["il y a"],
    timeUnits: { sec: ["seconde"], min: ["minute"], hour: ["heure"], day: ["jour"], week: ["semaine"], month: ["mois"] },
  },
  es: {
    acceptLang: "es,en;q=0.5",
    today: ["hoy"],
    yesterday: ["ayer"],
    months: { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 },
    replyWords: ["Respuestas", "Mensajes"],
    agoWord: ["hace"],
    timeUnits: { sec: ["segundo"], min: ["minuto"], hour: ["hora"], day: ["día", "dia"], week: ["semana"], month: ["mes"] },
  },
  it: {
    acceptLang: "it,en;q=0.5",
    today: ["oggi"],
    yesterday: ["ieri"],
    months: { gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11 },
    replyWords: ["Risposte", "Messaggi"],
    agoWord: ["fa"],
    timeUnits: { sec: ["secondo"], min: ["minuto"], hour: ["ora"], day: ["giorno"], week: ["settimana"], month: ["mese"] },
  },
  cs: {
    acceptLang: "cs,en;q=0.5",
    today: ["dnes"],
    yesterday: ["včera"],
    months: { led: 0, "úno": 1, uno: 1, "bře": 2, bre: 2, dub: 3, "kvě": 4, kve: 4, "čer": 5, cer: 5, "čvc": 6, cvc: 6, srp: 7, "zář": 8, zar: 8, "říj": 9, rij: 9, lis: 10, pro: 11 },
    replyWords: ["Odpovědi", "Odpovedi", "Příspěvky", "Prispevky"],
    agoWord: ["zpět", "zpet"],
    timeUnits: { sec: ["sekund"], min: ["minut"], hour: ["hodin"], day: ["den", "dní", "dni"], week: ["týdn", "tydn"], month: ["měsíc", "mesic"] },
  },
  nl: {
    acceptLang: "nl,en;q=0.5",
    today: ["vandaag"],
    yesterday: ["gisteren"],
    months: { jan: 0, feb: 1, mrt: 2, apr: 3, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11 },
    replyWords: ["Antwoorden", "Berichten", "Reacties"],
    agoWord: ["geleden"],
    timeUnits: { sec: ["seconde"], min: ["minuut", "minuten"], hour: ["uur"], day: ["dag", "dagen"], week: ["week", "weken"], month: ["maand", "maanden"] },
  },
  tr: {
    acceptLang: "tr,en;q=0.5",
    today: ["bugün"],
    yesterday: ["dün"],
    months: { oca: 0, "şub": 1, sub: 1, mar: 2, nis: 3, may: 4, haz: 5, tem: 6, "ağu": 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11 },
    replyWords: ["Yanıtlar", "Yanitlar", "Mesajlar", "Cevaplar"],
    agoWord: ["önce", "once"],
    timeUnits: { sec: ["saniye"], min: ["dakika"], hour: ["saat"], day: ["gün", "gun"], week: ["hafta"], month: ["ay"] },
  },
}

// ── Helpers ──

const DAY = 86400000

function fetchPage(url: string, lang: Lang): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  return fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": LANG_CONFIG[lang].acceptLang,
    },
  }).then(async (res) => {
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  }).catch((e) => { clearTimeout(timeout); throw e })
}

function resolveUrl(base: string, href: string): string {
  try { return new URL(href, base).href } catch { return href }
}

function parseCount(raw: string): number {
  const s = raw.trim().replace(/\s/g, "")
  if (/тыс|k$/i.test(s)) return Math.round(parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) * 1000)
  if (/млн|m$/i.test(s)) return Math.round(parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) * 1000000)
  return parseInt(s.replace(/[,.']/g, ""), 10) || 0
}

function htmlDecode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]*>/g, "").trim()
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
}

// ── Date parsing ──

function parseDate(raw: string, lang: Lang): number | undefined {
  const cfg = LANG_CONFIG[lang]
  const now = Date.now()
  const s = raw.trim().toLowerCase()

  // Today / yesterday — check ALL languages (forum may show dates in any lang)
  for (const lc of Object.values(LANG_CONFIG)) {
    for (const w of lc.today) { if (s.startsWith(w.toLowerCase())) return now }
    for (const w of lc.yesterday) { if (s.startsWith(w.toLowerCase())) return now - DAY }
  }

  // "X units ago" — check all languages
  const numMatch = s.match(/^(\d+)\s*(.+)$/)
  if (numMatch) {
    const n = parseInt(numMatch[1], 10)
    const rest = numMatch[2]
    for (const lc of Object.values(LANG_CONFIG)) {
      for (const [cat, words] of Object.entries(lc.timeUnits)) {
        if (words.some(w => rest.includes(w.toLowerCase()))) {
          const hasAgo = lc.agoWord.some(a => rest.includes(a.toLowerCase()))
          if (hasAgo || rest.length < 30) {
            if (cat === "sec") return now - n * 1000
            if (cat === "min") return now - n * 60000
            if (cat === "hour") return now - n * 3600000
            if (cat === "day") return now - n * DAY
            if (cat === "week") return now - n * 7 * DAY
            if (cat === "month") return now - n * 30 * DAY
          }
        }
      }
    }
  }

  // ISO: 2026-03-17T... or 2026-03-17
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) { const d = new Date(+iso[1], +iso[2] - 1, +iso[3]); if (!isNaN(d.getTime())) return d.getTime() }

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  const dmy4 = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (dmy4) { const d = new Date(+dmy4[3], +dmy4[2] - 1, +dmy4[1]); if (!isNaN(d.getTime())) return d.getTime() }

  // DD.MM.YY
  const dmy2 = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2})(?!\d)/)
  if (dmy2) { const y = +dmy2[3] + (+dmy2[3] > 50 ? 1900 : 2000); const d = new Date(y, +dmy2[2] - 1, +dmy2[1]); if (!isNaN(d.getTime())) return d.getTime() }

  // Named months — check all languages
  for (const lc of Object.values(LANG_CONFIG)) {
    for (const [prefix, monthIdx] of Object.entries(lc.months)) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // "17 марта 2026" or "Mar 17, 2026"
      const re1 = new RegExp(`(\\d{1,2})\\s+${escaped}[а-яёa-zà-ÿ]*[,.\\/\\s]*(\\d{4})?`, "i")
      const m1 = s.match(re1)
      if (m1) {
        const day = +m1[1], year = m1[2] ? +m1[2] : new Date().getFullYear()
        const d = new Date(year, monthIdx, day)
        if (!isNaN(d.getTime())) return d.getTime()
      }
      // "March 17, 2026"
      const re2 = new RegExp(`${escaped}[а-яёa-zà-ÿ]*\\s+(\\d{1,2})[,.\\/\\s]*(\\d{4})?`, "i")
      const m2 = s.match(re2)
      if (m2) {
        const day = +m2[1], year = m2[2] ? +m2[2] : new Date().getFullYear()
        const d = new Date(year, monthIdx, day)
        if (!isNaN(d.getTime())) return d.getTime()
      }
    }
  }

  return undefined
}

function extractDateFromBlock(block: string, lang: Lang): { dateStr?: string; timestamp?: number } {
  const dtAttr = block.match(/datetime="([^"]+)"/i)
  if (dtAttr) { const ts = parseDate(dtAttr[1], lang); if (ts) return { dateStr: dtAttr[1], timestamp: ts } }

  // data-timestamp (XenForo uses unix seconds)
  const tsAttr = block.match(/data-timestamp="(\d{10,13})"/i)
  if (tsAttr) {
    let ts = parseInt(tsAttr[1], 10)
    if (ts < 1e12) ts *= 1000 // seconds -> ms
    return { dateStr: new Date(ts).toISOString().slice(0, 10), timestamp: ts }
  }

  // Relative dates
  const relPatterns = [
    /(сегодня|вчера|today|yesterday|heute|gestern|aujourd'hui|hier|hoy|ayer|oggi|ieri|dnes|včera|vandaag|gisteren|bugün|dün)[\s,]*\d{0,2}:?\d{0,2}/i,
    /(\d+\s*[а-яёa-zà-ÿ]+\s*(?:назад|ago|vor|il y a|hace|fa|zpět|geleden|önce))/i,
  ]
  for (const p of relPatterns) {
    const m = block.match(p)
    if (m) { const ts = parseDate(m[0], lang); if (ts) return { dateStr: m[0].trim(), timestamp: ts } }
  }

  // Explicit dates
  const datePatterns = [
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})/,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2})(?!\d)/,
  ]
  for (const p of datePatterns) {
    const m = block.match(p)
    if (m) { const ts = parseDate(m[1], lang); if (ts) return { dateStr: m[1].trim(), timestamp: ts } }
  }

  // Named month dates (any language)
  const namedDate = block.match(/(\d{1,2}\s+[а-яёa-zà-ÿ]{3,}[,.\s]*\d{0,4})/i)
  if (namedDate) { const ts = parseDate(namedDate[1], lang); if (ts) return { dateStr: namedDate[1].trim(), timestamp: ts } }
  const namedDate2 = block.match(/([a-zа-яёà-ÿ]{3,}\s+\d{1,2}[,.\s]*\d{0,4})/i)
  if (namedDate2) { const ts = parseDate(namedDate2[1], lang); if (ts) return { dateStr: namedDate2[1].trim(), timestamp: ts } }

  return {}
}

// ── Engine detection ──

type Engine = "xenforo" | "phpbb" | "vbulletin" | "ipb" | "unknown"

function detectEngine(html: string): Engine {
  if (/data-xf=|xenforo|structItem/i.test(html)) return "xenforo"
  if (/phpbb|phpBB|viewtopic\.php/i.test(html)) return "phpbb"
  if (/vbulletin|vb_|showthread\.php|forumhome/i.test(html)) return "vbulletin"
  if (/ips[A-Z]|invision|ipb|ipsWidget|ipsTopic/i.test(html)) return "ipb"
  return "unknown"
}

// ── Reply word regex builder ──

function buildReplyRegex(): RegExp {
  const allWords: string[] = []
  for (const lc of Object.values(LANG_CONFIG)) {
    allWords.push(...lc.replyWords)
  }
  // Also add common English variants
  allWords.push("Replies", "Posts", "Messages", "Reply", "Post")
  const escaped = allWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return new RegExp(`<dt>\\s*(?:${escaped.join("|")})[^<]*<\\/dt>\\s*<dd>\\s*([\\d\\s.,а-яёa-zà-ÿ]+)\\s*<\\/dd>`, "i")
}

const REPLY_DL_RE = buildReplyRegex()

// ── Section link extraction (per engine) ──

function extractSectionLinks(html: string, baseUrl: string, engine: Engine): { name: string; url: string }[] {
  const sections: { name: string; url: string }[] = []
  const seen = new Set<string>()
  const clean = stripHtml(html)

  function add(href: string, name: string) {
    if (!name || name.length < 2 || sections.length >= 15) return
    const fullUrl = resolveUrl(baseUrl, href)
    if (seen.has(fullUrl)) return
    if (/(?:viewtopic|showthread|showtopic|threads\/\d|\/t\/\d|showpost)/i.test(fullUrl)) return
    seen.add(fullUrl)
    sections.push({ name: name.trim(), url: fullUrl })
  }

  let m: RegExpExecArray | null

  if (engine === "xenforo") {
    // node-title class
    const re = /class="[^"]*node-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re.exec(clean)) !== null) add(m[1], m[2])
  }

  if (engine === "phpbb") {
    // forumtitle class
    const re = /<a[^>]*class="[^"]*forumtitle[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re.exec(clean)) !== null) add(m[1], m[2])
    // viewforum links
    const re2 = /<a[^>]*href="([^"]*viewforum[^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re2.exec(clean)) !== null) add(m[1], m[2])
  }

  if (engine === "vbulletin") {
    // forumtitle / forum-title links
    const re = /<a[^>]*href="([^"]*(?:forumdisplay|forums\/)[^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re.exec(clean)) !== null) add(m[1], m[2])
    const re2 = /class="[^"]*(?:forumtitle|forum-title)[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re2.exec(clean)) !== null) add(m[1], m[2])
  }

  if (engine === "ipb") {
    // IPB forum links
    const re = /<a[^>]*href="([^"]*(?:forum\/|forums\/)[^"]*)"[^>]*title="([^"]{2,80})"/gi
    while ((m = re.exec(clean)) !== null) add(m[1], m[2])
    const re2 = /class="[^"]*ipsDataItem_title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi
    while ((m = re2.exec(clean)) !== null) add(m[1], m[2])
  }

  // Generic fallback for all engines
  if (sections.length === 0) {
    const patterns = [
      /class="[^"]*(?:forumtitle|forum[-_]?name|board[-_]?name|forumlink)[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi,
      /<a[^>]*class="[^"]*(?:forumtitle|forum[-_]?name|board[-_]?name|forumlink)[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]{2,80})<\/a>/gi,
      /<a[^>]*href="([^"]*(?:forums?\/[^"]*|board\/[^"]*|forumdisplay[^"]*|viewforum[^"]*))"\s[^>]*>([^<]{2,80})<\/a>/gi,
    ]
    for (const re of patterns) {
      while ((m = re.exec(clean)) !== null) add(m[1], m[2])
    }
  }

  return sections
}

// ── Topic extraction (per engine) ──

function extractTopics(html: string, engine: Engine, lang: Lang): TopicInfo[] {
  const topics: TopicInfo[] = []
  const clean = stripHtml(html)

  // ── XenForo ──
  if (engine === "xenforo") {
    const parts = clean.split(/(?=<div[^>]*class="[^"]*structItem\b[^"]*structItem--thread)/)
    for (const part of parts) {
      if (topics.length >= 100) break
      if (!part.includes("structItem--thread")) continue
      const chunk = part.slice(0, 6000)

      const titleMatch = chunk.match(/structItem-title[\s\S]{0,500}?<a[^>]*href="[^"]*threads\/[^"]*"[^>]*>([\s\S]{2,200}?)<\/a>/i)
      if (!titleMatch) continue
      const title = htmlDecode(titleMatch[1])
      if (!title || title.length < 2) continue

      let replies = 0
      const pm = chunk.match(REPLY_DL_RE)
      if (pm) replies = parseCount(pm[1])

      // Date: prefer data-timestamp, then structItem-cell--latest
      let dateInfo: { dateStr?: string; timestamp?: number } = {}
      const latestBlock = chunk.match(/structItem-cell--latest([\s\S]{0,1000})/i)
      if (latestBlock) dateInfo = extractDateFromBlock(latestBlock[1], lang)
      if (!dateInfo.timestamp) dateInfo = extractDateFromBlock(chunk, lang)

      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  // ── phpBB ──
  if (engine === "phpbb" && topics.length === 0) {
    const rows = clean.match(/<(?:tr|li|dl)[^>]*class="[^"]*(?:row|topic|announce|sticky|global)[^"]*"[^>]*>[\s\S]*?<\/(?:tr|li|dl)>/gi) || []
    for (const row of rows) {
      if (topics.length >= 100) break
      const titleMatch = row.match(/<a[^>]*href="[^"]*viewtopic[^"]*"[^>]*class="[^"]*topictitle[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
        || row.match(/<a[^>]*class="[^"]*topictitle[^"]*"[^>]*href="[^"]*viewtopic[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
        || row.match(/<a[^>]*href="[^"]*viewtopic[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = htmlDecode(titleMatch[1])

      let replies = 0
      const pm = row.match(REPLY_DL_RE)
      if (pm) { replies = parseCount(pm[1]) }
      else {
        // phpBB often has replies in a dd or span with class "posts"
        const postsMatch = row.match(/class="[^"]*(?:posts|replies)[^"]*"[^>]*>[\s]*(\d[\d,.']*)/i)
        if (postsMatch) replies = parseCount(postsMatch[1])
        else {
          // Fallback: numbers in <dd> tags
          const ddNums = row.match(/<dd[^>]*>\s*(\d[\d,.']*)\s*<\/dd>/gi) || []
          const nums = ddNums.map(dd => { const n = dd.match(/(\d[\d,.']*)/)?.[1]; return n ? parseCount(n) : 0 }).filter(n => n > 0)
          if (nums.length >= 1) replies = nums[0]
        }
      }

      const lastPostBlock = row.match(/class="[^"]*(?:last[-_]?post|lastpost|latest)[^"]*"[^>]*>([\s\S]{0,600})/i)
      const dateInfo = lastPostBlock ? extractDateFromBlock(lastPostBlock[1], lang) : extractDateFromBlock(row, lang)

      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  // ── vBulletin ──
  if (engine === "vbulletin" && topics.length === 0) {
    const rows = clean.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
    for (const row of rows) {
      if (topics.length >= 100) break
      if (!/showthread|threads\//i.test(row)) continue

      const titleMatch = row.match(/<a[^>]*href="[^"]*(?:showthread|threads\/)[^"]*"[^>]*id="[^"]*thread_title[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
        || row.match(/<a[^>]*href="[^"]*(?:showthread|threads\/)[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = htmlDecode(titleMatch[1])

      let replies = 0
      const pm = row.match(REPLY_DL_RE)
      if (pm) { replies = parseCount(pm[1]) }
      else {
        // vB: td with replies count, usually 2nd or 3rd numeric td
        const tdNums = row.match(/<td[^>]*>\s*(\d[\d,.']*)\s*<\/td>/gi) || []
        const nums = tdNums.map(td => { const n = td.match(/(\d[\d,.']*)/)?.[1]; return n ? parseCount(n) : 0 }).filter(n => n > 0)
        if (nums.length >= 1) replies = nums[0]
      }

      const lastPostBlock = row.match(/class="[^"]*(?:last[-_]?post|lastpost)[^"]*"[^>]*>([\s\S]{0,600})/i)
      const dateInfo = lastPostBlock ? extractDateFromBlock(lastPostBlock[1], lang) : extractDateFromBlock(row, lang)

      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  // ── IPB (Invision Power Board) ──
  if (engine === "ipb" && topics.length === 0) {
    const parts = clean.split(/(?=<(?:div|li|tr)[^>]*class="[^"]*ipsDataItem[^"]*")/)
    for (const part of parts) {
      if (topics.length >= 100) break
      if (!/ipsDataItem/i.test(part.slice(0, 200))) continue
      const chunk = part.slice(0, 5000)

      const titleMatch = chunk.match(/ipsDataItem_title[\s\S]{0,500}?<a[^>]*href="[^"]*(?:topic|forums?)[^"]*"[^>]*>([\s\S]{2,200}?)<\/a>/i)
        || chunk.match(/<a[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = htmlDecode(titleMatch[1])
      if (topics.some(t => t.title === title)) continue

      let replies = 0
      const pm = chunk.match(REPLY_DL_RE)
      if (pm) { replies = parseCount(pm[1]) }
      else {
        const statsMatch = chunk.match(/ipsDataItem_stats[\s\S]{0,300}?(\d[\d,.']*)/i)
        if (statsMatch) replies = parseCount(statsMatch[1])
      }

      const dateInfo = extractDateFromBlock(chunk, lang)
      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  // ── Fallback: generic table rows ──
  if (topics.length === 0) {
    const rows = clean.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
    for (const row of rows) {
      if (topics.length >= 100) break
      if (!/viewtopic|showtopic|showthread|threads?\/\d|topic\/\d/i.test(row)) continue

      const titleMatch = row.match(/<a[^>]*href="[^"]*(?:viewtopic|showthread|showtopic|threads?\/\d|topic\/\d)[^"]*"[^>]*>([^<]{2,150})<\/a>/i)
      if (!titleMatch) continue
      const title = htmlDecode(titleMatch[1])

      let replies = 0
      const pm = row.match(REPLY_DL_RE)
      if (pm) { replies = parseCount(pm[1]) }
      else {
        const tdNums = row.match(/<td[^>]*>\s*(\d[\d,.']*)\s*<\/td>/gi) || []
        const nums = tdNums.map(td => { const n = td.match(/(\d[\d,.']*)/)?.[1]; return n ? parseCount(n) : 0 }).filter(n => n > 0)
        if (nums.length >= 1) replies = nums[0]
      }

      const dateInfo = extractDateFromBlock(row, lang)
      topics.push({ title, replies, lastPostDate: dateInfo.dateStr, lastPostTimestamp: dateInfo.timestamp })
    }
  }

  return topics
}

// ── API handler ──

export async function POST(request: NextRequest) {
  try {
    const { url, lang = "ru" } = await request.json() as { url?: string; lang?: Lang }
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })
    const language: Lang = Object.keys(LANG_CONFIG).includes(lang) ? lang : "ru"

    // Step 1: Fetch main page
    let mainHtml: string
    try {
      mainHtml = await fetchPage(url, language)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить"
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Step 2: Detect engine
    const engine = detectEngine(mainHtml)

    // Step 3: Extract section links + topics from main page
    const sectionLinks = extractSectionLinks(mainHtml, url, engine)
    const mainTopics = extractTopics(mainHtml, engine, language)

    const sections: SectionInfo[] = []
    if (mainTopics.length > 0) {
      sections.push({ name: "Главная", url, topics: mainTopics })
    }

    // Step 4: Crawl sections in parallel (batches of 5, max 10)
    const toScan = sectionLinks.slice(0, 10)
    for (let i = 0; i < toScan.length; i += 5) {
      const batch = toScan.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(async (sec) => {
          const html = await fetchPage(sec.url, language)
          const topics = extractTopics(html, engine, language)
          return { name: sec.name, url: sec.url, topics }
        })
      )
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.topics.length > 0) sections.push(r.value)
      }
    }

    // Step 5: Aggregate
    const now = Date.now()
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
    const thirtyDaysAgo = now - 30 * DAY
    const sevenDaysAgo = now - 7 * DAY

    let totalTopics = 0, totalReplies = 0
    let topicsYear = 0, repliesYear = 0
    let topics30 = 0, replies30 = 0
    let topics7 = 0, replies7 = 0
    const seen = new Set<string>()

    for (const sec of sections) {
      for (const t of sec.topics) {
        const key = t.title.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        totalTopics++
        totalReplies += t.replies
        if (t.lastPostTimestamp && t.lastPostTimestamp >= yearStart) { topicsYear++; repliesYear += t.replies }
        if (t.lastPostTimestamp && t.lastPostTimestamp >= thirtyDaysAgo) { topics30++; replies30 += t.replies }
        if (t.lastPostTimestamp && t.lastPostTimestamp >= sevenDaysAgo) { topics7++; replies7 += t.replies }
      }
    }

    const cleanSections = sections.map(s => ({
      name: s.name, url: s.url,
      topics: s.topics.slice(0, 20).map(t => ({ title: t.title, replies: t.replies, lastPostDate: t.lastPostDate })),
    }))

    const result: ActivityResult = {
      engine,
      totalTopics, totalReplies,
      topicsThisYear: topicsYear, repliesThisYear: repliesYear,
      topicsLast30Days: topics30, repliesLast30Days: replies30,
      topicsLast7Days: topics7, repliesLast7Days: replies7,
      sectionsScanned: sections.length,
      sections: cleanSections as SectionInfo[],
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
