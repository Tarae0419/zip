import Link from "next/link"
import { adminSearchReviews } from "@/lib/db/queries"
import { ReviewRowActions } from "@/components/admin/review-row-actions"

const PAGE_SIZE = 30

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hidden?: string; page?: string }>
}) {
  const { q, hidden, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam ?? "1") || 1)
  const onlyHidden = hidden === "1"

  const { rows, total } = await adminSearchReviews({
    query: q,
    onlyHidden,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">리뷰 모더레이션</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        PRD 13.3 — 과목명·작성자로 검색하고, 부적절한 리뷰를 숨기거나 삭제해요. 총 {total.toLocaleString("ko-KR")}건.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin/reviews">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="과목명 또는 작성자 anonId"
          className="h-9 w-64 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" name="hidden" value="1" defaultChecked={onlyHidden} className="size-4 rounded border-input accent-primary" />
          숨김 처리된 리뷰만
        </label>
        <button type="submit" className="h-9 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          검색
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-border bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">과목</th>
              <th className="px-3 py-2 font-medium">작성자</th>
              <th className="px-3 py-2 font-medium">별점</th>
              <th className="px-3 py-2 font-medium">본문</th>
              <th className="px-3 py-2 font-medium">학기</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className={r.isFiltered ? "bg-destructive/5" : undefined}>
                <td className="max-w-[180px] truncate px-3 py-2.5 align-top">
                  <Link href={`/courses/${r.courseId}`} target="_blank" className="font-medium text-foreground hover:underline">
                    {r.courseName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.courseDepartment}</p>
                </td>
                <td className="px-3 py-2.5 align-top font-mono text-xs text-muted-foreground">{r.authorAnonId.slice(0, 8)}</td>
                <td className="px-3 py-2.5 align-top">{r.rating}점</td>
                <td className="max-w-sm px-3 py-2.5 align-top text-muted-foreground">
                  <p className="line-clamp-2">{r.body}</p>
                  {r.hashtags.length > 0 ? (
                    <p className="mt-1 text-xs text-primary">{r.hashtags.map((t) => `#${t}`).join(" ")}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top text-muted-foreground">{r.semester}</td>
                <td className="px-3 py-2.5 align-top">
                  {r.isFiltered ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">숨김</span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">노출</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <ReviewRowActions reviewId={r.id} isFiltered={r.isFiltered} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  조건에 맞는 리뷰가 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/reviews?${new URLSearchParams({ ...(q ? { q } : {}), ...(onlyHidden ? { hidden: "1" } : {}), page: String(page - 1) })}`}
              className="rounded-full border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
            >
              이전
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/reviews?${new URLSearchParams({ ...(q ? { q } : {}), ...(onlyHidden ? { hidden: "1" } : {}), page: String(page + 1) })}`}
              className="rounded-full border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
            >
              다음
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
