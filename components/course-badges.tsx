import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Requirement } from "@/lib/types"

// 학과 종속적인 이수구분 — 개설 학과의 커리큘럼에서만 그 의미(전공필수 등)가 성립한다.
// 교양/일반선택/교직/군사학은 학과와 무관하게 누구나 같은 의미로 들을 수 있어 그대로 둔다.
const MAJOR_SPECIFIC_REQUIREMENTS = new Set<Requirement>(["전공필수", "전공선택", "기초필수", "계열공통"])

/**
 * "전공필수"는 그 과목을 개설한 학과 학생에게만 실제로 필수다 — 다른 학과 학생이 보면 그냥
 * 일반선택으로 들을 수밖에 없는 과목이므로, 뷰어의 학과가 다르면 표시상 일반선택으로 보정한다.
 * 뷰어 학과를 모르면(로그인은 했지만 아직 학과를 안 정한 경우 등) 원본 값을 그대로 보여준다.
 */
export function resolveDisplayRequirement(
  requirement: Requirement,
  courseDepartment: string,
  viewerDepartment: string | null,
): Requirement {
  if (!MAJOR_SPECIFIC_REQUIREMENTS.has(requirement)) return requirement
  if (!viewerDepartment || courseDepartment === viewerDepartment) return requirement
  return "일반선택"
}

const requirementStyles: Record<Requirement, string> = {
  전공필수: "bg-primary/10 text-primary",
  전공선택: "bg-chart-2/15 text-chart-2",
  기초필수: "bg-chart-3/15 text-chart-3",
  계열공통: "bg-chart-4/15 text-chart-4",
  교양: "bg-muted text-muted-foreground",
  일반선택: "bg-chart-1/15 text-chart-1",
  교직: "bg-chart-5/15 text-chart-5",
  군사학: "bg-secondary text-secondary-foreground",
}

/** 카드 상단 accent bar 등 "옅은 배경"이 아니라 진한 배경색이 필요한 곳에서 쓴다. */
export const requirementAccentColor: Record<Requirement, string> = {
  전공필수: "bg-primary",
  전공선택: "bg-chart-2",
  기초필수: "bg-chart-3",
  계열공통: "bg-chart-4",
  교양: "bg-muted-foreground/60",
  일반선택: "bg-chart-1",
  교직: "bg-chart-5",
  군사학: "bg-secondary-foreground/60",
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
