import Link from "next/link"
import { notFound } from "next/navigation"
import { getCourseAdminDetail } from "@/lib/db/queries"
import { CoursePublicToggle } from "@/components/admin/course-public-toggle"
import { PrerequisitesEditor } from "@/components/admin/prerequisites-editor"
import { SummaryEditor } from "@/components/admin/summary-editor"
import { FieldTagsEditor } from "@/components/admin/field-tags-editor"
import { IndustryTagsEditor } from "@/components/admin/industry-tags-editor"

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const course = await getCourseAdminDetail(id)
  if (!course) notFound()

  return (
    <div>
      <Link href="/admin/courses" className="text-sm text-muted-foreground hover:text-foreground">
        ← 과목 목록
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-bold text-foreground">{course.name}</h1>
        <CoursePublicToggle courseId={course.id} isPublic={course.isPublic} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {course.department} · {course.code ?? "학수번호 없음"} · {course.semester} · 노출 중인 리뷰 {course.reviewCount}건
      </p>
      <Link href={`/courses/${course.id}`} target="_blank" className="mt-1 inline-block text-xs text-primary hover:underline">
        실제 과목 상세 페이지 열기 ↗
      </Link>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">AI 요약 (PRD 13.4)</h2>
        <p className="mt-1 text-xs text-muted-foreground">직접 고쳐 쓰거나, 리뷰를 바탕으로 다시 생성할 수 있어요.</p>
        <div className="mt-3">
          <SummaryEditor courseId={course.id} initialBody={course.summary?.body ?? ""} />
        </div>
        {course.summary ? (
          <p className="mt-2 text-xs text-muted-foreground">
            리뷰 {course.summary.basedReviewCount}건 기준 · {new Date(course.summary.generatedAt).toLocaleString("ko-KR")} 생성
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">학문분야 태그 (F2 / PRD 13.4)</h2>
        <div className="mt-3">
          <FieldTagsEditor courseId={course.id} tags={course.fieldTags} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">산업/진로 분야 태그 (F3 / PRD 13.4)</h2>
        <div className="mt-3">
          <IndustryTagsEditor courseId={course.id} tags={course.industryTags} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">선수과목 (F4 / PRD 13.5)</h2>
        <p className="mt-1 text-xs text-muted-foreground">현재 커리큘럼 데이터는 참고용 예시라 이 값도 확정된 교육과정표 기준이 아니에요.</p>
        <div className="mt-3">
          <PrerequisitesEditor courseId={course.id} initialCodes={course.prerequisiteCodes} />
        </div>
      </section>
    </div>
  )
}
