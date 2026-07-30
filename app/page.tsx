import Link from "next/link"
import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { HeroSearch } from "@/components/hero-search"
import { CourseCard } from "@/components/course-card"
import { Firefly } from "@/components/firefly"
import { popularTags } from "@/lib/mock-data"
import { getAnonId } from "@/lib/auth/anon-user"
import { getPopularCourses, getUserDepartment } from "@/lib/db/queries"

export default async function HomePage() {
  const anonId = await getAnonId()
  const myDepartment = await getUserDepartment(anonId)
  // 학과 정보가 있으면 "본인 학과 인기 과목"으로, 없으면(아직 /fields에서 설정 안 한 경우) 전체 기준으로 보여준다.
  const popularCourses = await getPopularCourses(6, myDepartment ?? undefined)

  return (
    <div className="min-h-svh">
      <AppHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/40 to-background">
          <div
            aria-hidden="true"
            className="bg-dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:py-24 md:px-6">
            <Firefly />
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              AI 기반 수강 도우미
            </span>
            <h1 className="mt-5 text-pretty bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text font-display text-3xl font-bold leading-tight tracking-tight text-transparent md:text-5xl">
              내게 딱 맞는 강의, <br className="hidden sm:block" />
              길잡이가 찾아드릴게요
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground md:text-lg">
              수많은 수강평을 AI가 요약하고, 관심 분야와 진로에 맞는 과목을 추천해요.
            </p>

            <div className="mx-auto mt-8 max-w-xl">
              <HeroSearch />
            </div>

            {/* 인기 분야 태그 */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">인기 분야</span>
              {popularTags.map((tag, i) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-fade-in-up rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 강의실 이동동선 지도 CTA */}
        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
          <div className="flex flex-col items-start gap-5 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
                  담은 강의, 시간표와 이동동선까지 한눈에
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  관심 있는 과목을 장바구니에 담으면 주간 시간표는 물론, 요일별로 강의실을 어떻게 이동해야
                  하는지 스케매틱 지도로 확인할 수 있어요.
                </p>
              </div>
            </div>
            <Link
              href="/cart"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              내 시간표 보러가기
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* 인기 과목 — 학과 정보가 있으면 본인 학과로 좁혀서 보여준다 */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
              {myDepartment ? `${myDepartment} 인기 과목` : "인기 과목"}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {myDepartment
              ? "최근 한 달 동안 우리 학과에서 수강평이 빠르게 늘고 있는 과목을 모았어요."
              : "최근 한 달 동안 수강평이 빠르게 늘고 있는 과목을 모았어요."}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} viewerDepartment={myDepartment} compact />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground md:px-6">
        <p className="font-display font-semibold text-foreground">수강길잡이</p>
        <p className="mt-1">
          대학생을 위한 AI 수강 도우미 · 개설 교과목 정보는 실제 수강편람 데이터를 사용하며,
          수강평·AI 요약·분야 추천 데이터는 아직 준비 중입니다.
        </p>
      </div>
    </footer>
  )
}
