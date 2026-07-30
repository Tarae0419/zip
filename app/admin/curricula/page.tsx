import Link from "next/link"
import { getAllCurricula } from "@/lib/db/queries"
import { CurriculumDeleteButton } from "@/components/admin/curriculum-delete-button"

export default async function AdminCurriculaPage() {
  const rows = await getAllCurricula()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">커리큘럼 데이터</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            PRD 13.5 — 학과별 졸업요건. 여기 추가한 학과는 코드 배포 없이 바로 /curriculum(F4)에서 지원돼요.
          </p>
        </div>
        <Link href="/admin/curricula/new" className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          + 새 커리큘럼
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-card text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">학과</th>
              <th className="px-3 py-2 font-medium">입학년도</th>
              <th className="px-3 py-2 font-medium">전공필수</th>
              <th className="px-3 py-2 font-medium">전공선택 최소학점</th>
              <th className="px-3 py-2 font-medium">총 이수학점</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2.5 font-medium text-foreground">{c.department}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.admissionYear}학번</td>
                <td className="px-3 py-2.5 text-muted-foreground">{((c.requiredCourseCodes as string[]) ?? []).length}개</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.electiveMinCredits}학점</td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.totalCreditsRequired}학점</td>
                <td className="px-3 py-2.5">
                  {c.dataStatus === "confirmed" ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">확정</span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">참고용</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={`/admin/curricula/${c.id}`} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-secondary">
                      수정
                    </Link>
                    <CurriculumDeleteButton id={c.id} label={`${c.department} ${c.admissionYear}학번`} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  아직 등록된 커리큘럼이 없어요.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
