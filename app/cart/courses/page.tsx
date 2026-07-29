import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, SearchX } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { CourseCard } from "@/components/course-card"
import { SemesterCourseFilterBar } from "@/components/semester-course-filter-bar"
import { getCoursesForSemester, getDistinctDepartments, getDistinctSemesters } from "@/lib/db/queries"
import { formatSemesterLabel } from "@/lib/timetable/schedule"

export default async function SemesterCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; q?: string; department?: string }>
}) {
  const { semester, q, department } = await searchParams
  if (!semester) redirect("/cart")

  const availableSemesters = await getDistinctSemesters()
  if (!availableSemesters.includes(semester)) redirect("/cart")

  const query = (q ?? "").trim()
  const selectedDepartment = department && department !== "전체" ? department : undefined

  const [courses, departments] = await Promise.all([
    getCoursesForSemester({ semester, query: query || undefined, department: selectedDepartment, limit: 30 }),
    getDistinctDepartments(),
  ])

  return (
    <div className="min-h-svh">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          내 시간표로 돌아가기
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            {formatSemesterLabel(semester)} 과목 담기
          </h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          이 학기에 개설된 과목만 보여드려요. 과목명으로 찾거나 학과로 좁혀서 시간표에 담아보세요.
        </p>

        <div className="mt-6">
          <SemesterCourseFilterBar
            semester={semester}
            query={query}
            department={selectedDepartment ?? "전체"}
            departments={departments}
          />
        </div>

        {courses.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <SearchX className="size-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="font-medium text-foreground">조건에 맞는 과목이 없어요</p>
            <p className="text-sm text-muted-foreground">다른 과목명이나 학과로 찾아보세요.</p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted-foreground">
              {query || selectedDepartment ? "검색 결과" : "수강인원이 많은 순으로 보여드려요"} · {courses.length}개
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
