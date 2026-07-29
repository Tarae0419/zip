import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Requirement } from "@/lib/types"

const requirementStyles: Record<Requirement, string> = {
  전공필수: "bg-primary/10 text-primary",
  전공선택: "bg-chart-2/15 text-chart-2",
  기초필수: "bg-chart-3/15 text-chart-3",
  계열공통: "bg-chart-4/15 text-chart-4",
  교양: "bg-muted text-muted-foreground",
}

/** 카드 상단 accent bar 등 "옅은 배경"이 아니라 진한 배경색이 필요한 곳에서 쓴다. */
export const requirementAccentColor: Record<Requirement, string> = {
  전공필수: "bg-primary",
  전공선택: "bg-chart-2",
  기초필수: "bg-chart-3",
  계열공통: "bg-chart-4",
  교양: "bg-muted-foreground/60",
}

export function RequirementBadge({
  requirement,
  className,
}: {
  requirement: Requirement
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        requirementStyles[requirement],
        className,
      )}
    >
      {requirement}
    </span>
  )
}

export function HashtagBadge({
  tag,
  percent,
  className,
}: {
  tag: string
  percent?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground",
        className,
      )}
    >
      <span>#{tag}</span>
      {percent !== undefined && (
        <span className="text-accent-foreground/70">{percent}%</span>
      )}
    </span>
  )
}

export function RatingStars({
  rating,
  size = 16,
  showValue = true,
  reviewCount,
}: {
  rating: number
  size?: number
  showValue?: boolean
  reviewCount?: number
}) {
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={
              i < rounded
                ? "fill-chart-5 text-chart-5"
                : "fill-muted text-muted"
            }
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-foreground">
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="text-sm text-muted-foreground">
          리뷰 {reviewCount}개
        </span>
      )}
      <span className="sr-only">{`5점 만점에 ${rating.toFixed(1)}점`}</span>
    </div>
  )
}
