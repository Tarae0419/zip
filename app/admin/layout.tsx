import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentAdminAnonId } from "@/lib/auth/admin"

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reviews", label: "리뷰 모더레이션" },
  { href: "/admin/courses", label: "과목 · AI 콘텐츠" },
  { href: "/admin/curricula", label: "커리큘럼" },
  { href: "/admin/users", label: "사용자" },
]

// PRD 13.2 — 로그인 가드는 proxy.ts가 이미 처리하고, 여기서는 role=admin인지만 추가로 확인한다.
// Server Action 쪽은 이 레이아웃을 거치지 않고 직접 호출될 수 있어 lib/auth/admin.ts의
// requireAdmin()으로 각 액션 안에서 별도로 다시 검사한다.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminAnonId = await getCurrentAdminAnonId()
  if (!adminAnonId) {
    redirect("/")
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3 md:px-6">
          <span className="mr-4 font-display text-sm font-bold text-foreground">관리자</span>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="ml-auto text-sm text-muted-foreground transition hover:text-foreground">
            ← 서비스로 돌아가기
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
    </div>
  )
}
