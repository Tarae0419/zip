import { adminSearchUsers } from "@/lib/db/queries"
import { UserRowActions } from "@/components/admin/user-row-actions"

const PAGE_SIZE = 30

function maskStudentId(id: string | null): string {
  if (!id) return "-"
  if (id.length <= 4) return "*".repeat(id.length)
  return `${id.slice(0, 4)}${"*".repeat(Math.max(1, id.length - 6))}${id.slice(-2)}`
}

function maskEmail(email: string | null): string {
  if (!email) return "-"
  const [local, domain] = email.split("@")
  if (!domain) return "*".repeat(email.length)
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam ?? "1") || 1)

  const { rows, total } = await adminSearchUsers({ query: q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">사용자 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        PRD 13.7 — 학번·이름·이메일로 검색해요. 개인정보 최소 수집 원칙에 따라 학번·이메일은 마스킹해서 보여줘요. 총{" "}
        {total.toLocaleString("ko-KR")}명.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin/users">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="학번, 이름, 이메일"
          className="h-9 w-64 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <button type="submit" className="h-9 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          검색
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium">학번</th>
              <th className="px-3 py-2 font-medium">이메일</th>
              <th className="px-3 py-2 font-medium">학과</th>
              <th className="px-3 py-2 font-medium">권한</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2.5 font-medium text-foreground">{u.name ?? "-"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{maskStudentId(u.studentId)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{maskEmail(u.email)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.department ?? "-"}</td>
                <td className="px-3 py-2.5">
                  {u.role === "admin" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">관리자</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">일반</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {u.status === "suspended" ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">정지</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">활성</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <UserRowActions userId={u.id} role={u.role} status={u.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  조건에 맞는 사용자가 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
