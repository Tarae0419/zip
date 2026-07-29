import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { Course } from "@/lib/mock-data"
import { HashtagBadge, RatingStars, RequirementBadge } from "@/components/course-badges"

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
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">
              {course.name}
            </h3>
            <RequirementBadge requirement={course.requirement} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {course.department} · {course.professor} · {course.credits}학점
          </p>
        </div>
        {ownMajorLabel ? (
          <span
            className={
              ownMajorLabel === "내 전공 과목"
                ? "shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                : "shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            }
          >
            {ownMajorLabel}
          </span>
        ) : (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        )}
      </div>

      <div className="mt-3">
        <RatingStars rating={course.rating} reviewCount={course.reviewCount} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {course.hashtags.slice(0, 2).map((h) => (
          <HashtagBadge key={h.tag} tag={h.tag} percent={h.percent} />
        ))}
      </div>
    </Link>
  )
}
