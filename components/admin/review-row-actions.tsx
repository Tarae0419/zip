"use client"

import { useState, useTransition } from "react"
import { adminDeleteReview, adminSetReviewFiltered } from "@/lib/actions/admin/reviews"

export function ReviewRowActions({ reviewId, isFiltered }: { reviewId: string; isFiltered: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    setError(null)
    startTransition(async () => {
      const result = await adminSetReviewFiltered(reviewId, !isFiltered)
      if (!result.ok) setError(result.error)
    })
  }

  function handleDelete() {
    if (!window.confirm("이 리뷰를 완전히 삭제할까요? 되돌릴 수 없어요.")) return
    setError(null)
    startTransition(async () => {
      const result = await adminDeleteReview(reviewId)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {isFiltered ? "복원" : "숨김"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-full border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
