import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { Course } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { HashtagBadge, RatingStars, requirementAccentColor, RequirementBadge } from "@/components/course-badges"

export function CourseCard({
  course,
  ownMajorLabel,
}: {
  course: Course
  ownMajorLabel?: "내 전공 과목" | "타 전공 과목"
}) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 pt-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* 이수구분별 accent bar */}
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-[3px]", requirementAccentColor[course.requirement])} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">
              {course.name}
            </h3>
            <RequirementBadge requirement={course.requirement} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>
              {course.department} · {course.professor}
            </span>
            <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-bold tabular-nums text-secondary-foreground">
              {course.credits}학점
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

      <div className="mt-3">
        <RatingStars rating={course.rating} reviewCount={course.reviewCount} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {course.hashtags.slice(0, 3).map((h) => (
          <HashtagBadge key={h.tag} tag={h.tag} percent={h.percent} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 pt-3 text-sm font-medium text-primary opacity-0 transition-opacity duration-200 motion-safe:group-hover:opacity-100">
        자세히 보기
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  )
}
