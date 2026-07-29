import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageSquareText } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { AiSummaryCard } from "@/components/ai-summary-card"
import { ReviewList } from "@/components/review-list"
import { ReviewComposer } from "@/components/review-composer"
import { RatingStars, RequirementBadge } from "@/components/course-badges"
import { getCourseById, getReviewsByCourseId, mockCourses } from "@/lib/mock-data"

export function generateStaticParams() {
  return mockCourses.map((c) => ({ id: c.id }))
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = getCourseById(id)

  if (!course) {
    notFound()
  }

  const reviews = getReviewsByCourseId(course.id)

  return (
    <div className="min-h-svh">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          홈으로
        </Link>

        {/* 과목 정보 */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              {course.name}
            </h1>
            <RequirementBadge requirement={course.requirement} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {course.department} · {course.professor} · {course.credits}학점
          </p>
          <div className="mt-3">
            <RatingStars rating={course.rating} reviewCount={course.reviewCount} />
          </div>
        </div>

        {/* AI 요약 카드 (가장 눈에 띄게 상단 배치) */}
        <div className="mt-6">
          <AiSummaryCard summary={course.summary} hashtags={course.hashtags} />
        </div>

        {/* 개별 수강평 */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-foreground">
                수강평
                <span className="ml-1.5 text-base font-normal text-muted-foreground">
                  {course.reviewCount}
                </span>
              </h2>
              <span className="text-xs text-muted-foreground">· 최신순</span>
            </div>
            <ReviewComposer />
          </div>

          <div className="mt-4">
            <ReviewList reviews={reviews} />
          </div>
        </section>
      </main>
    </div>
  )
}
