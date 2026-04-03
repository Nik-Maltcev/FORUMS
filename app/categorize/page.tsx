"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, Loader2, Download, Tag, Eye, EyeOff, X } from "lucide-react"

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

interface CategorizeResult {
  category: string
  confidence: "высокая" | "средняя" | "низкая"
  description: string
  error?: string
}

interface ForumCatResult {
  url: string
  status: "pending" | "checking" | "done" | "error"
  result?: CategorizeResult
}

export default function CategorizePage() {
  const [input, setInput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [lang, setLang] = useState("ru")
  const [results, setResults] = useState<ForumCatResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const parseUrls = (text: string): string[] =>
    text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => (u.startsWith("http") ? u : `https://${u}`))

  const checkOne = async (url: string, i: number) => {
    setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "checking" } : r)))
    try {
      const res = await fetch("/api/categorize-forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey: apiKey.trim(), lang }),
      })
      const data: CategorizeResult = await res.json()
      if (data.error) {
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "error", result: data } : r)))
      } else {
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "done", result: data } : r)))
      }
    } catch {
      setResults((prev) => prev.map((r, idx) =>
        idx === i ? { ...r, status: "error", result: { category: "", confidence: "низкая", description: "", error: "Не удалось выполнить запрос" } } : r
      ))
    }
  }

  const handleCheck = async () => {
    const urls = parseUrls(input)
    if (urls.length === 0 || !apiKey.trim()) return

    setIsChecking(true)
    setActiveFilter(null)
    setResults(urls.map((url) => ({ url, status: "pending" })))

    // Process 2 forums in parallel (Kimi limit: 3 concurrent)
    for (let i = 0; i < urls.length; i += 2) {
      const batch = urls.slice(i, i + 2)
      await Promise.allSettled(batch.map((url, j) => checkOne(url, i + j)))
    }

    setIsChecking(false)
  }

  // Collect unique categories from done results, sorted by count
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of results) {
      if (r.status === "done" && r.result?.category) {
        counts[r.result.category] = (counts[r.result.category] || 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [results])

  const filteredResults = useMemo(() => {
    if (!activeFilter) return results
    return results.filter(
      (r) => r.status === "done" && r.result?.category === activeFilter
    )
  }, [results, activeFilter])

  const getConfidenceColor = (confidence?: string) => {
    if (confidence === "высокая") return "bg-green-500/10 text-green-600 border-green-500/20"
    if (confidence === "средняя") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    return "bg-orange-500/10 text-orange-600 border-orange-500/20"
  }

  const exportCsv = () => {
    const done = results.filter((r) => r.status === "done" || r.status === "error")
    if (done.length === 0) return

    const bom = "\uFEFF"
    const headers = ["URL", "Категория", "Уверенность", "Описание", "Ошибка"]
    const escCsv = (val: string) =>
      val.includes(";") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val

    const rows = done.map((r) =>
      [
        escCsv(r.url),
        escCsv(r.result?.category || ""),
        escCsv(r.result?.confidence || ""),
        escCsv(r.result?.description || ""),
        escCsv(r.result?.error || ""),
      ].join(";")
    )

    const csv = bom + headers.map(escCsv).join(";") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forum-categories-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doneCount = results.filter((r) => r.status === "done").length

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Категоризация форумов</h1>
          <p className="text-muted-foreground">Определение тематики форумов с помощью Kimi K2.5</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Настройки</CardTitle>
            <CardDescription>
              Получите API ключ на{" "}
              <a href="https://platform.moonshot.cn" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                platform.moonshot.cn
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Kimi API Key (MOONSHOT_API_KEY)"
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
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Язык / страна форумов</div>
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
                  Анализирую...
                </>
              ) : (
                <>
                  <Tag className="mr-2 h-4 w-4" />
                  Определить категории
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

            {/* Category filter chips */}
            {categories.length > 1 && (
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
                {categories.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      activeFilter === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {cat} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {filteredResults.map((result, idx) => (
                <Card key={idx}>
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary hover:underline break-all"
                      >
                        {result.url}
                      </a>
                      {result.status === "done" && result.result?.description && (
                        <p className="text-sm text-muted-foreground">{result.result.description}</p>
                      )}
                      {result.status === "error" && result.result?.error && (
                        <p className="text-sm text-muted-foreground">{result.result.error}</p>
                      )}
                    </div>

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
                        <>
                          <Badge className={getConfidenceColor(result.result.confidence)}>
                            {result.result.confidence}
                          </Badge>
                          <Badge variant="secondary" className="font-medium">
                            {result.result.category}
                          </Badge>
                        </>
                      )}
                      {result.status === "error" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Ошибка
                        </Badge>
                      )}
                    </div>
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
