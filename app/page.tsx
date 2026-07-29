import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { HeroSearch } from "@/components/hero-search"
import { CourseCard } from "@/components/course-card"
import { mockCourses, popularTags } from "@/lib/mock-data"

export default function HomePage() {
  const popularCourses = mockCourses

  return (
    <div className="min-h-svh">
      <AppHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24 md:px-6">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              AI 기반 수강 도우미
            </span>
            <h1 className="mt-5 text-pretty font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
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
              {popularTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 이번 학기 인기 과목 */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
              이번 학기 인기 과목
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            수강평이 많고 평점이 높은 과목을 모았어요.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
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
          대학생을 위한 AI 수강 도우미 · 본 화면은 목업 데이터로 구성된 디자인 초안입니다.
        </p>
      </div>
    </footer>
  )
}
