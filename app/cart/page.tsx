import { AppHeader } from "@/components/app-header"
import { CartTimetableView } from "@/components/cart-timetable-view"
import { getCoursesForSemester, getDistinctDepartments, getDistinctSemesters } from "@/lib/db/queries"

export const metadata = {
  title: "내 시간표 — 수강길잡이",
  description: "장바구니에 담은 강의의 주간 시간표와 요일별 강의실 이동동선을 확인하세요.",
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; q?: string; department?: string }>
}) {
  const { semester, q, department } = await searchParams

  const availableSemesters = await getDistinctSemesters()
  // 학년도를 명시하지 않았으면 가장 최신 학기를 기본으로 보여준다.
  const activeSemester = semester && availableSemesters.includes(semester) ? semester : availableSemesters[0]

  const query = (q ?? "").trim()
  const selectedDepartment = department && department !== "전체" ? department : undefined

  const [browsableCourses, departments] = activeSemester
    ? await Promise.all([
        getCoursesForSemester({ semester: activeSemester, query: query || undefined, department: selectedDepartment, limit: 30 }),
        getDistinctDepartments(),
      ])
    : [[], []]

  return (
    <div className="min-h-svh">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">내 시간표</h1>
        <p className="mt-1 text-muted-foreground">
          학년도를 고르고 과목을 담으면, 시간표와 요일별 강의실 이동동선을 바로 확인할 수 있어요.
        </p>

        <div className="mt-8">
          <CartTimetableView
            availableSemesters={availableSemesters}
            activeSemester={activeSemester ?? ""}
            departments={departments}
            department={selectedDepartment ?? "전체"}
            query={query}
            browsableCourses={browsableCourses}
          />
        </div>
      </main>
    </div>
  )
}
