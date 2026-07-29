"use client"

import { useState } from "react"
import type { Review } from "@/lib/mock-data"
import { HashtagBadge, RatingStars } from "@/components/course-badges"

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
  const [expanded, setExpanded] = useState(false)
  const isLong = review.body.length > CLAMP_LENGTH
  const shown =
    isLong && !expanded ? `${review.body.slice(0, CLAMP_LENGTH)}...` : review.body

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <RatingStars rating={review.rating} showValue={false} size={15} />
        <span className="text-xs text-muted-foreground">{review.semester}</span>
      </div>

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
