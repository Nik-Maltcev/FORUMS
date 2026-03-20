"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, Loader2, Download, Activity, Eye, EyeOff, X } from "lucide-react"

interface ActivityResult {
  activityLevel: "высокая" | "средняя" | "низкая" | "мёртвый"
  postsPerWeek: string
  uniqueAuthors: string
  contentQuality: string
  dateSpread: string
  verdict: string
  error?: string
}

interface ForumActivityResult {
  url: string
  status: "pending" | "checking" | "done" | "error"
  result?: ActivityResult
}

export default function ActivityPage() {
  const [input, setInput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [results, setResults] = useState<ForumActivityResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const parseUrls = (text: string): string[] =>
    text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => (u.startsWith("http") ? u : `https://${u}`))

  const handleCheck = async () => {
    const urls = parseUrls(input)
    if (urls.length === 0 || !apiKey.trim()) return

    setIsChecking(true)
    setActiveFilter(null)
    setResults(urls.map((url) => ({ url, status: "pending" })))

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "checking" } : r)))

      try {
        const res = await fetch("/api/check-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, apiKey: apiKey.trim() }),
        })
        const data: ActivityResult = await res.json()

        if (data.error) {
          setResults((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "error", result: data } : r))
          )
        } else {
          setResults((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "done", result: data } : r))
          )
        }
      } catch {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "error", result: { activityLevel: "мёртвый", postsPerWeek: "0", uniqueAuthors: "0", contentQuality: "", dateSpread: "", verdict: "", error: "Не удалось выполнить запрос" } }
              : r
          )
        )
      }
    }

    setIsChecking(false)
  }

  const activityLevels = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of results) {
      if (r.status === "done" && r.result?.activityLevel) {
        counts[r.result.activityLevel] = (counts[r.result.activityLevel] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [results])

  const filteredResults = useMemo(() => {
    if (!activeFilter) return results
    return results.filter(
      (r) => r.status === "done" && r.result?.activityLevel === activeFilter
    )
  }, [results, activeFilter])

  const getActivityColor = (level?: string) => {
    if (level === "высокая") return "bg-green-500/10 text-green-600 border-green-500/20"
    if (level === "средняя") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    if (level === "низкая") return "bg-orange-500/10 text-orange-600 border-orange-500/20"
    return "bg-red-500/10 text-red-600 border-red-500/20"
  }

  const getActivityEmoji = (level?: string) => {
    if (level === "высокая") return "🟢"
    if (level === "средняя") return "🟡"
    if (level === "низкая") return "🟠"
    return "🔴"
  }

  const exportCsv = () => {
    const done = results.filter((r) => r.status === "done" || r.status === "error")
    if (done.length === 0) return

    const bom = "\uFEFF"
    const headers = ["URL", "Активность", "Постов/неделю", "Уникальных авторов", "Качество контента", "Вердикт", "Ошибка"]
    const escCsv = (val: string) =>
      val.includes(";") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val

    const rows = done.map((r) =>
      [
        escCsv(r.url),
        escCsv(r.result?.activityLevel || ""),
        escCsv(r.result?.postsPerWeek || ""),
        escCsv(r.result?.uniqueAuthors || ""),
        escCsv(r.result?.contentQuality || ""),
        escCsv(r.result?.verdict || ""),
        escCsv(r.result?.error || ""),
      ].join(";")
    )

    const csv = bom + headers.map(escCsv).join(";") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forum-activity-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doneCount = results.filter((r) => r.status === "done").length

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Проверка целостности форумов</h1>
          <p className="text-muted-foreground">AI-анализ реальной активности: где люди общаются, а где форум заброшен</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Настройки</CardTitle>
            <CardDescription>
              Получите бесплатный API ключ на{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                aistudio.google.com
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Gemini API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Список форумов</CardTitle>
            <CardDescription>Один URL на строку или через запятую</CardDescription>
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
              disabled={isChecking || !input.trim() || !apiKey.trim()}
              className="w-full sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Анализирую активность...
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

            {/* Activity level filter chips */}
            {activityLevels.length > 1 && (
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
                {activityLevels.map(([level, count]) => (
                  <button
                    key={level}
                    onClick={() => setActiveFilter(activeFilter === level ? null : level)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      activeFilter === level
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {getActivityEmoji(level)} {level} <span className="opacity-60">{count}</span>
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
                            Анализ
                          </Badge>
                        )}
                        {result.status === "pending" && (
                          <Badge variant="outline">Ожидание</Badge>
                        )}
                        {result.status === "done" && result.result && (
                          <Badge className={getActivityColor(result.result.activityLevel)}>
                            {getActivityEmoji(result.result.activityLevel)} {result.result.activityLevel}
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
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Постов/неделю</div>
                            <div className="text-sm font-medium">{result.result.postsPerWeek}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Уникальных авторов</div>
                            <div className="text-sm font-medium">{result.result.uniqueAuthors}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Разброс дат</div>
                            <div className="text-sm font-medium">{result.result.dateSpread}</div>
                          </div>
                          <div className="rounded-lg border p-2.5">
                            <div className="text-xs text-muted-foreground">Качество контента</div>
                            <div className="text-sm font-medium">{result.result.contentQuality}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{result.result.verdict}</p>
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
