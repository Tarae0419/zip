import Link from "next/link"
import { Compass, Hash, Layers, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const FEATURES = [
  {
    icon: Hash,
    title: "수강평 해시태그 + AI 요약",
    description: "수강평이 쌓이면 AI가 특징을 짧은 문장으로 요약하고, 대표 해시태그로 한눈에 보여줘요.",
  },
  {
    icon: Search,
    title: "통합 검색",
    description: "과목명은 물론, 관심 있는 학문 분야 키워드로도 원하는 과목을 찾을 수 있어요.",
  },
  {
    icon: Layers,
    title: "산업/진로 분야 검색",
    description: "\"반도체\", \"모빌리티\" 같은 진로 키워드로 학과를 넘나드는 관련 과목을 한 번에 찾아요.",
  },
  {
    icon: Sparkles,
    title: "AI 커리큘럼 설계",
    description: "학년·학기·관심 분야를 입력하면 졸업까지 남은 학기의 수강 로드맵을 AI가 짜드려요.",
  },
]

export default function WelcomePage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-gradient-to-b from-accent/40 to-background">
      <div
        aria-hidden="true"
        className="bg-dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
          <Link href="/welcome" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">수강길잡이</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              로그인
            </Link>
            <Button render={<Link href="/signup" />} size="sm">
              회원가입
            </Button>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24 md:px-6">
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

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button render={<Link href="/signup" />} size="lg">
                무료로 시작하기
              </Button>
              <Button render={<Link href="/login" />} size="lg" variant="outline">
                로그인
              </Button>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-primary/5"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-3.5 font-display text-sm font-bold text-foreground">{feature.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground md:px-6">
            <p className="font-display font-semibold text-foreground">수강길잡이</p>
            <p className="mt-1">
              대학생을 위한 AI 수강 도우미 · 실제 학교 수강편람 데이터를 기반으로 동작해요.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
