"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Trash2 } from "lucide-react"
import type { Review } from "@/lib/types"
import { HashtagBadge, RatingStars } from "@/components/course-badges"
import { deleteReview } from "@/lib/actions/reviews"

const CLAMP_LENGTH = 90

export function ReviewList({ reviews }: { reviews: Review[] }) {
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </div>
  )
}

function ReviewItem({ review }: { review: Review }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isLong = review.body.length > CLAMP_LENGTH
  const shown =
    isLong && !expanded ? `${review.body.slice(0, CLAMP_LENGTH)}...` : review.body

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteReview(review.id)
      if (!result.ok) {
        setError(result.error)
        setConfirmingDelete(false)
        return
      }
      router.refresh()
    })
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <RatingStars rating={review.rating} showValue={false} size={15} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{review.semester}</span>
          {review.isOwn && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label="내 수강평 삭제"
              className="rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>이 수강평을 삭제할까요? 되돌릴 수 없어요.</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isPending}
              className="rounded-full px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {isPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              삭제
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
        {shown}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 font-medium text-primary hover:underline"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {review.hashtags.map((tag) => (
          <HashtagBadge key={tag} tag={tag} />
        ))}
      </div>
    </article>
  )
}
