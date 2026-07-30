import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"
import { HashtagBadge, RatingStars, requirementAccentColor, RequirementBadge, resolveDisplayRequirement } from "@/components/course-badges"
import { CartToggleButton } from "@/components/cart-toggle-button"
import { formatMinutes, parseTimeSlots } from "@/lib/timetable/schedule"

export function CourseCard({
  course,
  ownMajorLabel,
  viewerDepartment = null,
  compact = false,
}: {
  course: Course
  ownMajorLabel?: "내 전공 과목" | "타 전공 과목"
  // "전공필수" 같은 학과 종속적 이수구분은 뷰어 학과가 다르면 배지에 "일반선택"으로 보정해 보여준다.
  viewerDepartment?: string | null
  // 홈 "인기 과목" 카드처럼 상세 보기 유도만 하면 되는 자리에서는 장바구니 담기 버튼을 빼고
  // 카드 자체도 살짝 작게 — 시간표에 담을 과목을 "고르는" 화면이 아니라서 담기 버튼이 불필요하다.
  compact?: boolean
}) {
  // course.timeSlots는 "과목 추가"(시간표) 카드 목록에서만 채워진다 — 다른 화면에서는 undefined라 아무것도 안 뜬다.
  const sessions = course.timeSlots ? parseTimeSlots(course.id, course.name, course.timeSlots) : []
  const displayRequirement = resolveDisplayRequirement(course.requirement, course.department, viewerDepartment)

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        compact ? "p-4 pt-5" : "p-5 pt-6",
      )}
    >
      {/* 카드 전체를 클릭 영역으로 유지하되(stretched-link), 장바구니 버튼은 z-10으로 위에 떠서 독립적으로 클릭된다 */}
      <Link href={`/courses/${course.id}`} className="absolute inset-0 z-0" aria-label={`${course.name} 상세보기`} />

      {/* 이수구분별 accent bar */}
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-[3px]", requirementAccentColor[displayRequirement])} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">
              {course.name}
            </h3>
            <RequirementBadge requirement={displayRequirement} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>
              {course.department} · {course.professor}
            </span>
            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-bold tabular-nums text-secondary-foreground">
              {course.credits}학점
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {course.semester}학기
            </span>
          </p>
        </div>
        {ownMajorLabel && (
          <span
            className={
              ownMajorLabel === "내 전공 과목"
                ? "shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                : "shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            }
          >
            {ownMajorLabel}
          </span>
        )}
      </div>

      {sessions.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {sessions.map((session, i) => (
            <span key={i} className="tabular-nums">
              {session.day} {formatMinutes(session.startMinutes)}~{formatMinutes(session.endMinutes)}
            </span>
          ))}
        </p>
      )}

      <div className={compact ? "mt-2.5" : "mt-3"}>
        <RatingStars rating={course.rating} reviewCount={course.reviewCount} />
      </div>

      <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-3" : "mt-4")}>
        {course.hashtags.slice(0, compact ? 2 : 3).map((h) => (
          <HashtagBadge key={h.tag} tag={h.tag} percent={h.percent} />
        ))}
      </div>

      <div className={cn("mt-auto flex items-center gap-2 pt-3", compact ? "justify-end" : "justify-between")}>
        {!compact && <CartToggleButton courseId={course.id} size="sm" />}
        <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-200 motion-safe:group-hover:opacity-100">
          자세히 보기
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
