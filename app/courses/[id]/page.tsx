import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, MapPin, MessageSquareText, Sparkles } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { AiSummaryCard } from "@/components/ai-summary-card"
import { ReviewList } from "@/components/review-list"
import { ReviewComposer } from "@/components/review-composer"
import { RatingStars, RequirementBadge, resolveDisplayRequirement } from "@/components/course-badges"
import { CartToggleButton } from "@/components/cart-toggle-button"
import { getCourseView, getUserDepartment } from "@/lib/db/queries"
import { getCartCourseInfo } from "@/lib/actions/cart"
import { getAnonId } from "@/lib/auth/anon-user"
import { buildSessionsForCourse, formatMinutes } from "@/lib/timetable/schedule"
import type { Course } from "@/lib/types"

// PRD F1 — 요약을 생성하기 위한 최소 리뷰 수
const MIN_REVIEWS_FOR_SUMMARY = 5

// 개설 과목이 5천 건 이상이라 빌드 시 전량 정적 생성하지 않고 요청 시점에 렌더링한다.
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const anonId = await getAnonId()
  const [result, cartInfo, myDepartment] = await Promise.all([
    getCourseView(id, anonId),
    getCartCourseInfo(id),
    getUserDepartment(anonId),
  ])

  if (!result) {
    notFound()
  }

  const { course, reviews } = result
  const scheduleSessions = cartInfo ? buildSessionsForCourse(cartInfo) : []
  const displayRequirement = resolveDisplayRequirement(course.requirement, course.department, myDepartment)

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
            <RequirementBadge requirement={displayRequirement} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {course.department} · {course.professor} · {course.credits}학점
          </p>
          <div className="mt-3">
            <RatingStars rating={course.rating} reviewCount={course.reviewCount} />
          </div>

          <div className="mt-4">
            <CartToggleButton courseId={course.id} size="default" />
          </div>
        </div>

        {/* 강의 시간 및 장소 */}
        {scheduleSessions.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-4 md:p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-foreground">강의 시간 및 장소</h2>
            </div>
            <ul className="mt-3 space-y-2">
              {scheduleSessions.map((session, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{session.day}요일</span>
                  <span>
                    {formatMinutes(session.startMinutes)}~{formatMinutes(session.endMinutes)}
                  </span>
                  {session.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {session.location.building} {session.location.room}호
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              장바구니에 담으면 <Link href="/cart" className="font-medium text-primary underline underline-offset-2">내 시간표</Link>에서
              요일별 강의실 이동동선을 지도로 볼 수 있어요.
            </p>
          </section>
        )}

        {/* AI 요약 카드 (가장 눈에 띄게 상단 배치) */}
        <div className="mt-6">
          <CourseAiSummarySection course={course} />
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
            <ReviewComposer courseId={course.id} />
          </div>

          <div className="mt-4">
            <ReviewList reviews={reviews} />
          </div>
        </section>
      </main>
    </div>
  )
}

// PRD 8.1 Edge Case: 리뷰 0개 / 5개 미만 / 충분(요약 생성 전·후)을 구분해 안내한다.
function CourseAiSummarySection({ course }: { course: Course }) {
  if (course.reviewCount === 0) {
    return (
      <EmptySummaryNotice
        title="아직 등록된 수강평이 없어요"
        description="첫 수강평을 남기면 AI가 다른 학생들을 위해 강의 특징을 요약해드려요."
      />
    )
  }

  if (course.reviewCount < MIN_REVIEWS_FOR_SUMMARY) {
    return (
      <EmptySummaryNotice
        title="리뷰가 아직 충분하지 않습니다"
        description={`AI 요약은 리뷰 ${MIN_REVIEWS_FOR_SUMMARY}개 이상부터 제공돼요. 지금까지 ${course.reviewCount}개의 수강평이 등록됐어요.`}
      />
    )
  }

  if (!course.summary) {
    return (
      <EmptySummaryNotice
        title="AI 요약을 준비하고 있어요"
        description="리뷰는 충분히 모였지만 아직 요약이 생성되지 않았어요. 곧 업데이트될 예정이에요."
      />
    )
  }

  return <AiSummaryCard summary={course.summary} hashtags={course.hashtags} />
}

function EmptySummaryNotice({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center md:p-7">
      <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-display font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </section>
  )
}
