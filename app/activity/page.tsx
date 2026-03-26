"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, Loader2, Download, Activity, X, ChevronDown, ChevronUp } from "lucide-react"

const LANGUAGES = [
  { code: "ru", label: "🇷🇺 RU" },
  { code: "en", label: "🇬🇧 EN" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "es", label: "🇪🇸 ES" },
  { code: "it", label: "🇮🇹 IT" },
  { code: "cs", label: "🇨🇿 CS" },
  { code: "nl", label: "🇳🇱 NL" },
  { code: "tr", label: "🇹🇷 TR" },
] as const

interface TopicInfo { title: string; replies: number; lastPostDate?: string }
interface SectionInfo { name: string; url: string; topics: TopicInfo[] }

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

type Verdict = "активный" | "средний" | "слабый" | "мёртвый" | "ошибка"

interface ForumResult {
  url: string
  status: "pending" | "checking" | "done" | "error"
  result?: ActivityResult
  verdict?: Verdict
  expanded?: boolean
}

function getVerdict(r: ActivityResult): Verdict {
  // Primary: replies this year
  if (r.repliesThisYear >= 500) return "активный"
  if (r.repliesThisYear >= 50) return "средний"
  if (r.repliesThisYear >= 1) return "слабый"
  // Fallback: if no year data, check 30d
  if (r.repliesLast30Days >= 100) return "активный"
  if (r.repliesLast30Days >= 10) return "средний"
  if (r.repliesLast30Days >= 1) return "слабый"
  return "мёртвый"
}

export default function ActivityPage() {
  const [input, setInput] = useState("")
  const [lang, setLang] = useState("ru")
  const [results, setResults] = useState<ForumResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [activeFilter, setActiveFilter] = useState<Verdict | null>(null)

  const parseUrls = (text: string): string[] =>
    text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0).map(u => u.startsWith("http") ? u : `https://${u}`)

  const checkOne = async (url: string, i: number) => {
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "checking" } : r))
    try {
      const res = await fetch("/api/check-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, lang }),
      })
      const data: ActivityResult = await res.json()
      if (data.error) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", result: data } : r))
      } else {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", result: data, verdict: getVerdict(data) } : r))
      }
    } catch {
      setResults(prev => prev.map((r, idx) => idx === i
        ? { ...r, status: "error", result: { engine: "unknown", totalTopics: 0, totalReplies: 0, topicsThisYear: 0, repliesThisYear: 0, topicsLast30Days: 0, repliesLast30Days: 0, topicsLast7Days: 0, repliesLast7Days: 0, sectionsScanned: 0, sections: [], error: "Не удалось выполнить запрос" }, verdict: "ошибка" as Verdict }
        : r))
    }
  }

  const handleCheck = async () => {
    const urls = parseUrls(input)
    if (!urls.length) return
    setIsChecking(true)
    setActiveFilter(null)
    setResults(urls.map(url => ({ url, status: "pending" })))
    for (let i = 0; i < urls.length; i += 3) {
      const batch = urls.slice(i, i + 3)
      await Promise.allSettled(batch.map((url, j) => checkOne(url, i + j)))
    }
    setIsChecking(false)
  }

  const toggleExpand = (idx: number) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r))
  }

  const verdictCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of results) if (r.verdict && r.verdict !== "ошибка") c[r.verdict] = (c[r.verdict] || 0) + 1
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [results])

  const filtered = useMemo(() => activeFilter ? results.filter(r => r.verdict === activeFilter) : results, [results, activeFilter])

  const vc = (v?: string) => {
    if (v === "активный") return "bg-green-500/10 text-green-600 border-green-500/20"
    if (v === "средний") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    if (v === "слабый") return "bg-orange-500/10 text-orange-600 border-orange-500/20"
    return "bg-red-500/10 text-red-600 border-red-500/20"
  }
  const ve = (v?: string) => v === "активный" ? "🟢" : v === "средний" ? "🟡" : v === "слабый" ? "🟠" : "🔴"

  const engineLabel = (e?: string) => {
    if (e === "xenforo") return "XenForo"
    if (e === "phpbb") return "phpBB"
    if (e === "vbulletin") return "vBulletin"
    if (e === "ipb") return "IPB"
    return "?"
  }

  const exportCsv = () => {
    const done = results.filter(r => r.status === "done" || r.status === "error")
    if (!done.length) return
    const bom = "\uFEFF"
    const h = ["URL", "Движок", "Вердикт", "Всего тем", "Всего сообщ.", "Тем за год", "Сообщ. за год", "Тем за 30д", "Сообщ. за 30д", "Тем за 7д", "Сообщ. за 7д", "Разделов", "Ошибка"]
    const esc = (v: string) => v.includes(";") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v
    const rows = done.map(r => [
      esc(r.url), esc(r.result?.engine || ""), esc(r.verdict || ""),
      String(r.result?.totalTopics ?? ""), String(r.result?.totalReplies ?? ""),
      String(r.result?.topicsThisYear ?? ""), String(r.result?.repliesThisYear ?? ""),
      String(r.result?.topicsLast30Days ?? ""), String(r.result?.repliesLast30Days ?? ""),
      String(r.result?.topicsLast7Days ?? ""), String(r.result?.repliesLast7Days ?? ""),
      String(r.result?.sectionsScanned ?? ""), esc(r.result?.error || ""),
    ].join(";"))
    const csv = bom + h.map(esc).join(";") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const u = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = u; a.download = `forum-activity-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(u)
  }

  const doneCount = results.filter(r => r.status === "done").length

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Проверка целостности форумов</h1>
          <p className="text-muted-foreground">Краулинг разделов, подсчёт сообщений за год / 30д / 7д. Движки: XenForo, phpBB, vBulletin, IPB.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Настройки</CardTitle>
            <CardDescription>Выберите язык форумов для точного парсинга дат и счётчиков</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    lang === l.code ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Список форумов</CardTitle>
            <CardDescription>Один URL на строку или через запятую. До 10 разделов на форум.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`forum.example.com\nhttps://another-forum.org`}
              className="min-h-[150px] font-mono text-sm"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <Button onClick={handleCheck} disabled={isChecking || !input.trim()} className="w-full sm:w-auto">
              {isChecking
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сканирую...</>
                : <><Activity className="mr-2 h-4 w-4" />Проверить активность</>}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Результаты
                {activeFilter && <span className="ml-2 text-base font-normal text-muted-foreground">— {activeFilter} ({filtered.length})</span>}
              </h2>
              {doneCount > 0 && (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />CSV
                </Button>
              )}
            </div>

            {verdictCounts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {activeFilter && (
                  <button onClick={() => setActiveFilter(null)} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm bg-primary text-primary-foreground">
                    <X className="h-3 w-3" />Сбросить
                  </button>
                )}
                {verdictCounts.map(([v, count]) => (
                  <button key={v} onClick={() => setActiveFilter(activeFilter === v ? null : v as Verdict)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${activeFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                    {ve(v)} {v} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {filtered.map((r, idx) => (
                <Card key={idx}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-primary hover:underline break-all">{r.url}</a>
                        {r.result?.engine && r.status === "done" && (
                          <span className="ml-2 text-xs text-muted-foreground">{engineLabel(r.result.engine)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.status === "checking" && <Badge variant="secondary" className="gap-1"><Spinner className="h-3 w-3" />Сканирую</Badge>}
                        {r.status === "pending" && <Badge variant="outline">Ожидание</Badge>}
                        {r.status === "done" && r.verdict && <Badge className={vc(r.verdict)}>{ve(r.verdict)} {r.verdict}</Badge>}
                        {r.status === "error" && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Ошибка</Badge>}
                      </div>
                    </div>

                    {r.status === "done" && r.result && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">За {new Date().getFullYear()} год</div>
                            <div className="text-lg font-semibold">{r.result.repliesThisYear.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{r.result.topicsThisYear} тем</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">За 30 дней</div>
                            <div className="text-lg font-semibold">{r.result.repliesLast30Days.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{r.result.topicsLast30Days} тем</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">За 7 дней</div>
                            <div className="text-lg font-semibold">{r.result.repliesLast7Days.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{r.result.topicsLast7Days} тем</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Всего</div>
                            <div className="text-lg font-semibold">{r.result.totalReplies.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">{r.result.totalTopics} тем</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Разделов</div>
                            <div className="text-lg font-semibold">{r.result.sectionsScanned}</div>
                          </div>
                        </div>

                        {r.result.sections.length > 0 && (
                          <button onClick={() => toggleExpand(idx)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            {r.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {r.expanded ? "Скрыть" : "Показать"} разделы и темы
                          </button>
                        )}

                        {r.expanded && r.result.sections.map((sec, sIdx) => (
                          <div key={sIdx} className="rounded-lg border p-3 space-y-2">
                            <div className="text-sm font-medium">{sec.name}</div>
                            <div className="space-y-1">
                              {sec.topics.map((t, tIdx) => (
                                <div key={tIdx} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate text-muted-foreground">{t.title}</span>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-mono">{t.replies} отв.</span>
                                    {t.lastPostDate && <span className="text-muted-foreground">{t.lastPostDate}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {r.status === "error" && r.result?.error && (
                      <p className="text-sm text-muted-foreground">{r.result.error}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
