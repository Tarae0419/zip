"use client"

import { useState, useTransition } from "react"
import { adminRegenerateSummary, adminUpdateSummary } from "@/lib/actions/admin/courses"

export function SummaryEditor({ courseId, initialBody }: { courseId: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await adminUpdateSummary(courseId, body)
      setMessage(result.ok ? "저장했어요." : result.error)
    })
  }

  function handleRegenerate() {
    setMessage(null)
    startTransition(async () => {
      const result = await adminRegenerateSummary(courseId)
      if (result.ok) {
        setMessage("재생성했어요. 새로고침하면 최신 내용이 보여요.")
      } else {
        setMessage(result.error)
      }
    })
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="아직 생성된 AI 요약이 없어요."
        className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          직접 수정 저장
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          AI로 재생성
        </button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  )
}
