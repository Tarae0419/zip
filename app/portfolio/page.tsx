import { AppHeader } from "@/components/app-header"
import { PortfolioBuilder } from "@/components/portfolio-builder"

export const metadata = {
  title: "내 포트폴리오 — 수강길잡이",
  description: "커리큘럼 활동을 포트폴리오 계획과 결과물로 연결하세요.",
}

export default function PortfolioPage() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">내 포트폴리오</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
          커리큘럼에서 계획한 활동을 가져오고, 역할·기술·결과·회고를 채워 실제 포트폴리오로 발전시켜보세요.
        </p>
        <div className="mt-8"><PortfolioBuilder /></div>
      </main>
    </div>
  )
}
