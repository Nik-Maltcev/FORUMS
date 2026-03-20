"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, Loader2, Download, Activity, X, ChevronDown, ChevronUp } from "lucide-react"

interface TopicInfo {
  title: string
  replies: number
  lastPostDate?: string
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

type Verdict = "активный" | "средний" | "слабый" | "мёртвый" | "ошибка"

interface ForumActivityResult {
  url: string
  status: "pending" | "checking" | "done" | "error"
  result?: ActivityResult
  verdict?: Verdict
  expanded?: boolean
}

function getVerdict(r: ActivityResult): Verdict {
  if (r.repliesLast30Days >= 100) return "активный"
  if (r.repliesLast30Days >= 20) return "средний"
  if (r.repliesLast30Days >= 1) return "слабый"
  return "мёртвый"
}

export default function ActivityPage() {
  const [input, setInput] = useState("")
  const [results, setResults] = useState<ForumActivityResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [activeFilter, setActiveFilter] = useState<Verdict | null>(null)

  const parseUrls = (text: string): string[] =>
    text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => (u.startsWith("http") ? u : `https://${u}`))

  const checkOne = async (url: string, i: number) => {
    setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "checking" } : r)))
    try {
      const res = await fetch("/api/check-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data: ActivityResult = await res.json()
      if (data.error) {
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", result: data } : r))
        )
      } else {
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", result: data, verdict: getVerdict(data) } : r))
        )
      }
    } catch {
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? { ...r, status: "error", result: { totalTopics: 0, totalReplies: 0, topicsLast30Days: 0, repliesLast30Days: 0, topicsLast7Days: 0, repliesLast7Days: 0, sectionsScanned: 0, sections: [], error: "Не удалось выполнить запрос" } as ActivityResult, verdict: "ошибка" as Verdict }
            : r
        )
      )
    }
  }

  const handleCheck = async () => {
    const urls = parseUrls(input)
    if (urls.length === 0) return

    setIsChecking(true)
    setActiveFilter(null)
    setResults(urls.map((url) => ({ url, status: "pending" })))

    // Process 3 forums in parallel
    for (let i = 0; i < urls.length; i += 3) {
      const batch = urls.slice(i, i + 3)
      await Promise.allSettled(batch.map((url, j) => checkOne(url, i + j)))
    }

    setIsChecking(false)
  }

  const toggleExpand = (idx: number) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, expanded: !r.expanded } : r)))
  }

  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of results) {
      if (r.verdict && r.verdict !== "ошибка") {
        counts[r.verdict] = (counts[r.verdict] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [results])

  const filteredResults = useMemo(() => {
    if (!activeFilter) return results
    return results.filter((r) => r.verdict === activeFilter)
  }, [results, activeFilter])

  const getVerdictColor = (v?: string) => {
    if (v === "активный") return "bg-green-500/10 text-green-600 border-green-500/20"
    if (v === "средний") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    if (v === "слабый") return "bg-orange-500/10 text-orange-600 border-orange-500/20"
    return "bg-red-500/10 text-red-600 border-red-500/20"
  }

  const getVerdictEmoji = (v?: string) => {
    if (v === "активный") return "🟢"
    if (v === "средний") return "🟡"
    if (v === "слабый") return "🟠"
    return "🔴"
  }

  const exportCsv = () => {
    const done = results.filter((r) => r.status === "done" || r.status === "error")
    if (done.length === 0) return

    const bom = "\uFEFF"
    const headers = ["URL", "Вердикт", "Всего тем", "Всего сообщений", "Тем за 30д", "Сообщений за 30д", "Тем за 7д", "Сообщений за 7д", "Разделов", "Ошибка"]
    const escCsv = (val: string) =>
      val.includes(";") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val

    const rows = done.map((r) =>
      [
        escCsv(r.url),
        escCsv(r.verdict || ""),
        String(r.result?.totalTopics ?? ""),
        String(r.result?.totalReplies ?? ""),
        String(r.result?.topicsLast30Days ?? ""),
        String(r.result?.repliesLast30Days ?? ""),
        String(r.result?.topicsLast7Days ?? ""),
        String(r.result?.repliesLast7Days ?? ""),
        String(r.result?.sectionsScanned ?? ""),
        escCsv(r.result?.error || ""),
      ].join(";")
    )

    const csv = bom + headers.map(escCsv).join(";") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const csvUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = csvUrl
    a.download = `forum-activity-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(csvUrl)
  }

  const doneCount = results.filter((r) => r.status === "done").length

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Проверка целостности форумов</h1>
          <p className="text-muted-foreground">Краулинг разделов форума и подсчёт сообщений за 30 дней</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Список форумов</CardTitle>
            <CardDescription>Один URL на строку или через запятую. Для каждого форума будут просканированы разделы (до 10).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`forum.example.com\nhttps://another-forum.org\nthird-forum.net`}
              className="min-h-[150px] font-mono text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button
              onClick={handleCheck}
              disabled={isChecking || !input.trim()}
              className="w-full sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сканирую разделы...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  Проверить активность
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Результаты
                {activeFilter && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    — {activeFilter} ({filteredResults.length})
                  </span>
                )}
              </h2>
              {doneCount > 0 && (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать CSV
                </Button>
              )}
            </div>

            {verdictCounts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {activeFilter && (
                  <button
                    onClick={() => setActiveFilter(null)}
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm bg-primary text-primary-foreground"
                  >
                    <X className="h-3 w-3" />
                    Сбросить
                  </button>
                )}
                {verdictCounts.map(([v, count]) => (
                  <button
                    key={v}
                    onClick={() => setActiveFilter(activeFilter === v ? null : v as Verdict)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      activeFilter === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {getVerdictEmoji(v)} {v} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {filteredResults.map((result, idx) => (
                <Card key={idx}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary hover:underline break-all"
                      >
                        {result.url}
                      </a>
                      <div className="flex items-center gap-2 shrink-0">
                        {result.status === "checking" && (
                          <Badge variant="secondary" className="gap-1">
                            <Spinner className="h-3 w-3" />
                            Сканирую
                          </Badge>
                        )}
                        {result.status === "pending" && <Badge variant="outline">Ожидание</Badge>}
                        {result.status === "done" && result.verdict && (
                          <Badge className={getVerdictColor(result.verdict)}>
                            {getVerdictEmoji(result.verdict)} {result.verdict}
                          </Badge>
                        )}
                        {result.status === "error" && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Ошибка
                          </Badge>
                        )}
                      </div>
                    </div>

                    {result.status === "done" && result.result && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Сообщений за 30д</div>
                            <div className="text-lg font-semibold">{result.result.repliesLast30Days.toLocaleString()}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Сообщений за 7д</div>
                            <div className="text-lg font-semibold">{result.result.repliesLast7Days.toLocaleString()}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Активных тем за 30д</div>
                            <div className="text-lg font-semibold">{result.result.topicsLast30Days}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Разделов</div>
                            <div className="text-lg font-semibold">{result.result.sectionsScanned}</div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Всего найдено: {result.result.totalTopics} тем, {result.result.totalReplies.toLocaleString()} сообщений
                        </div>

                        {result.result.sections.length > 0 && (
                          <button
                            onClick={() => toggleExpand(idx)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {result.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {result.expanded ? "Скрыть" : "Показать"} разделы и темы
                          </button>
                        )}

                        {result.expanded && result.result.sections.map((section, sIdx) => (
                          <div key={sIdx} className="rounded-lg border p-3 space-y-2">
                            <div className="text-sm font-medium">{section.name}</div>
                            <div className="space-y-1">
                              {section.topics.map((topic, tIdx) => (
                                <div key={tIdx} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate text-muted-foreground">{topic.title}</span>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-mono">{topic.replies} отв.</span>
                                    {topic.lastPostDate && <span className="text-muted-foreground">{topic.lastPostDate}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.status === "error" && result.result?.error && (
                      <p className="text-sm text-muted-foreground">{result.result.error}</p>
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
