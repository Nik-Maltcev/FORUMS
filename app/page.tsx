"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, XCircle, AlertCircle, Globe, Loader2, Download } from "lucide-react"

interface ForumCheck {
  hasCategories: boolean
  hasTopics: boolean
  hasPosts: boolean
  hasPagination: boolean
  hasLastDates: boolean
  hasAuthors: boolean
  hasCounters: boolean
  countersFound: string[]
  lastDateFound?: string
  isDateFresh: boolean
  latestYear?: number
  error?: string
}

interface ForumResult {
  url: string
  status: "pending" | "checking" | "done" | "error"
  check?: ForumCheck
  score?: number
  verdict?: string
}

export default function ForumChecker() {
  const [input, setInput] = useState("")
  const [results, setResults] = useState<ForumResult[]>([])
  const [isChecking, setIsChecking] = useState(false)

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,]+/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => (url.startsWith("http") ? url : `https://${url}`))
  }

  const checkForum = async (url: string): Promise<ForumCheck> => {
    const response = await fetch("/api/check-forum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      throw new Error("Failed to check forum")
    }

    return response.json()
  }

  const calculateScore = (check: ForumCheck): { score: number; verdict: string } => {
    const points = [
      check.hasCategories,
      check.hasTopics,
      check.hasPosts,
      check.hasPagination,
      check.hasLastDates,
      check.hasAuthors,
      check.hasCounters,
      check.isDateFresh, // new: fresh date is important
    ].filter(Boolean).length

    const score = Math.round((points / 8) * 100)

    let verdict: string
    
    // If no fresh dates (last activity before 2026), mark as inactive regardless of score
    if (!check.isDateFresh && check.latestYear) {
      verdict = `Неактивен с ${check.latestYear}`
    } else if (score >= 70) {
      verdict = "Активный"
    } else if (score >= 40) {
      verdict = "Малоактивный"
    } else if (score > 0) {
      verdict = "Почти мёртвый"
    } else {
      verdict = "Мёртвый"
    }

    return { score, verdict }
  }

  const handleCheck = async () => {
    const urls = parseUrls(input)
    if (urls.length === 0) return

    setIsChecking(true)
    setResults(urls.map((url) => ({ url, status: "pending" })))

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]

      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "checking" } : r))
      )

      try {
        const check = await checkForum(url)
        const { score, verdict } = calculateScore(check)

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "done", check, score, verdict } : r
          )
        )
      } catch {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "error",
                  check: {
                    hasCategories: false,
                    hasTopics: false,
                    hasPosts: false,
                    hasPagination: false,
                    hasLastDates: false,
                    hasAuthors: false,
                    hasCounters: false,
                    countersFound: [],
                    isDateFresh: false,
                    error: "Не удалось загрузить",
                  },
                }
              : r
          )
        )
      }
    }

    setIsChecking(false)
  }

  const getVerdictColor = (verdict?: string) => {
    if (!verdict) return "bg-red-500/10 text-red-600 border-red-500/20"
    if (verdict === "Активный") return "bg-green-500/10 text-green-600 border-green-500/20"
    if (verdict === "Малоактивный") return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
    if (verdict === "Почти мёртвый") return "bg-orange-500/10 text-orange-600 border-orange-500/20"
    if (verdict.startsWith("Неактивен с")) return "bg-red-500/10 text-red-600 border-red-500/20"
    return "bg-red-500/10 text-red-600 border-red-500/20"
  }

  const exportCsv = () => {
    const doneResults = results.filter(r => r.status === "done" || r.status === "error")
    if (doneResults.length === 0) return

    const bom = "\uFEFF"
    const headers = [
      "URL",
      "Статус",
      "Счёт %",
      "Вердикт",
      "Разделы",
      "Темы",
      "Сообщения",
      "Пагинация",
      "Даты постов",
      "Авторы",
      "Счётчики",
      "Свежий",
      "Последний год",
      "Последняя дата",
      "Найдены счётчики",
      "Ошибка",
    ]

    const escCsv = (val: string) => {
      if (val.includes(";") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const yn = (v?: boolean) => (v ? "Да" : "Нет")

    const rows = doneResults.map(r => [
      escCsv(r.url),
      r.status === "error" ? "Ошибка" : "ОК",
      r.score != null ? String(r.score) : "",
      escCsv(r.verdict || ""),
      yn(r.check?.hasCategories),
      yn(r.check?.hasTopics),
      yn(r.check?.hasPosts),
      yn(r.check?.hasPagination),
      yn(r.check?.hasLastDates),
      yn(r.check?.hasAuthors),
      yn(r.check?.hasCounters),
      yn(r.check?.isDateFresh),
      r.check?.latestYear != null ? String(r.check.latestYear) : "",
      escCsv(r.check?.lastDateFound || ""),
      escCsv(r.check?.countersFound?.join(", ") || ""),
      escCsv(r.check?.error || ""),
    ].join(";"))

    const csv = bom + headers.map(escCsv).join(";") + "\n" + rows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forum-check-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const CheckItem = ({ checked, label }: { checked: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/50" />
      )}
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  )

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Проверка форумов</h1>
          <p className="text-muted-foreground">
            Вставьте список URL форумов для проверки их активности
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Список форумов</CardTitle>
            <CardDescription>
              Один URL на строку или через запятую
            </CardDescription>
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
                  Проверяю...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Проверить форумы
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Результаты</h2>
              {results.some(r => r.status === "done" || r.status === "error") && (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Скачать CSV
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {results.map((result, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <div className="flex items-start justify-between gap-4 p-4 pb-0">
                    <div className="min-w-0 flex-1">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary hover:underline break-all"
                      >
                        {result.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.status === "checking" && (
                        <Badge variant="secondary" className="gap-1">
                          <Spinner className="h-3 w-3" />
                          Проверка
                        </Badge>
                      )}
                      {result.status === "pending" && (
                        <Badge variant="outline">Ожидание</Badge>
                      )}
                      {result.status === "done" && result.verdict && (
                        <>
                          <Badge variant="outline">{result.score}%</Badge>
                          <Badge className={getVerdictColor(result.verdict)}>
                            {result.verdict}
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

                  {result.check && result.status === "done" && (
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                        <CheckItem
                          checked={result.check.hasCategories}
                          label="Разделы"
                        />
                        <CheckItem
                          checked={result.check.hasTopics}
                          label="Темы"
                        />
                        <CheckItem
                          checked={result.check.hasPosts}
                          label="Сообщения"
                        />
                        <CheckItem
                          checked={result.check.hasPagination}
                          label="Пагинация"
                        />
                        <CheckItem
                          checked={result.check.hasLastDates}
                          label="Даты постов"
                        />
                        <CheckItem
                          checked={result.check.hasAuthors}
                          label="Авторы"
                        />
                        <CheckItem
                          checked={result.check.hasCounters}
                          label="Счётчики"
                        />
                        <CheckItem
                          checked={result.check.isDateFresh}
                          label={result.check.latestYear ? `Свежий (${result.check.latestYear})` : "Свежие даты"}
                        />
                      </div>

                      {result.check.countersFound.length > 0 && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          <span className="font-medium">Найдены счётчики:</span>{" "}
                          {result.check.countersFound.join(", ")}
                        </div>
                      )}

                      {result.check.lastDateFound && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium">Последняя дата:</span>{" "}
                          {result.check.lastDateFound}
                        </div>
                      )}
                    </CardContent>
                  )}

                  {result.status === "error" && result.check?.error && (
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        {result.check.error}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
