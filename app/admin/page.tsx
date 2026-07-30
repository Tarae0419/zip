import { getAdminDashboardStats } from "@/lib/db/queries"

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats()

  const cards = [
    { label: "전체 리뷰", value: stats.totalReviews, hint: `숨김 처리 ${stats.hiddenReviews}건 (최근 7일 ${stats.hiddenReviewsLast7Days}건)` },
    { label: "전체 사용자", value: stats.totalUsers, hint: `신규 가입 최근 7일 ${stats.newUsersLast7Days}명 · 관리자 ${stats.adminCount}명` },
    { label: "전체 과목", value: stats.totalCourses, hint: `공개 ${stats.publicCourses}건 · 비공개 ${stats.totalCourses - stats.publicCourses}건` },
    { label: "AI 요약 보유 과목", value: stats.coursesWithSummary, hint: "리뷰 5개 이상 누적된 과목 기준" },
  ]

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">운영 대시보드</h1>
      <p className="mt-1 text-sm text-muted-foreground">PRD 13.8 — 핵심 운영 지표를 한눈에 확인해요.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1.5 font-display text-3xl font-bold text-foreground">{card.value.toLocaleString("ko-KR")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
