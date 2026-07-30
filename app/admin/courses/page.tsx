import Link from "next/link"
import { adminSearchCourses } from "@/lib/db/queries"
import { CoursePublicToggle } from "@/components/admin/course-public-toggle"

const PAGE_SIZE = 30

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam ?? "1") || 1)

  const { rows, total } = await adminSearchCourses({ query: q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">과목 · AI 콘텐츠</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        PRD 13.6 — 과목 노출 여부를 관리하고, 과목을 눌러 AI 요약·분야 태그를 검수해요. 총 {total.toLocaleString("ko-KR")}건.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin/courses">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="과목명, 학수번호, 개설학과"
          className="h-9 w-72 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <button type="submit" className="h-9 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          검색
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">과목명</th>
              <th className="px-3 py-2 font-medium">학수번호</th>
              <th className="px-3 py-2 font-medium">개설학과</th>
              <th className="px-3 py-2 font-medium">이수구분</th>
              <th className="px-3 py-2 font-medium">학기</th>
              <th className="px-3 py-2 font-medium">노출</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/courses/${c.id}`} className="font-medium text-foreground hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.code ?? "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.department}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.requirementType}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.semester}</td>
                <td className="px-3 py-2.5">
                  <CoursePublicToggle courseId={c.id} isPublic={c.isPublic} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  조건에 맞는 과목이 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={`/admin/courses?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`} className="rounded-full border border-border px-3 py-1.5 text-foreground hover:bg-secondary">
              이전
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/admin/courses?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`} className="rounded-full border border-border px-3 py-1.5 text-foreground hover:bg-secondary">
              다음
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
