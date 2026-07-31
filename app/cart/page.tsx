import { AppHeader } from "@/components/app-header"
import { CartTimetableView } from "@/components/cart-timetable-view"
import {
  COURSES_FOR_SEMESTER_PAGE_SIZE,
  getCoursesForSemester,
  getDistinctDepartments,
  getDistinctSemesters,
  getUserDepartment,
} from "@/lib/db/queries"
import { getAnonId } from "@/lib/auth/anon-user"

export const metadata = {
  title: "내 시간표 — 수강길잡이",
  description: "장바구니에 담은 강의의 주간 시간표와 요일별 강의실 이동동선을 확인하세요.",
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; q?: string; department?: string; grade?: string; category?: string; page?: string }>
}) {
  const { semester, q, department, grade, category, page } = await searchParams

  // 서로 의존관계가 없는 두 조회를 동시에 보낸다 — Neon HTTP 드라이버는 커넥션을 재사용하지
  // 않아 쿼리 하나당 왕복이 100~250ms씩 붙는데, 예전엔 학기 목록을 먼저 기다린 뒤에야
  // 학과 목록을 요청해서 그 두 배를 매번 물었다.
  const anonId = await getAnonId()
  const [availableSemesters, departments, myDepartment] = await Promise.all([
    getDistinctSemesters(),
    getDistinctDepartments(),
    getUserDepartment(anonId),
  ])
  // 학년도를 명시하지 않았으면 가장 최신 학기를 기본으로 보여준다.
  const activeSemester = semester && availableSemesters.includes(semester) ? semester : availableSemesters[0]

  const query = (q ?? "").trim()
  const selectedDepartment = department && department !== "전체" ? department : undefined
  const selectedGrade = grade && grade !== "전체" ? Number(grade) : undefined
  const selectedCategory = category === "전공" || category === "교양" ? category : undefined
  const currentPage = Math.max(1, Number(page) || 1)

  const { courses: browsableCourses, totalCount: browsableTotalCount } = activeSemester
    ? await getCoursesForSemester({
        semester: activeSemester,
        query: query || undefined,
        department: selectedDepartment,
        grade: selectedGrade,
        category: selectedCategory,
        page: currentPage,
      })
    : { courses: [], totalCount: 0 }
  const browsableTotalPages = Math.max(1, Math.ceil(browsableTotalCount / COURSES_FOR_SEMESTER_PAGE_SIZE))

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
            grade={selectedGrade ? String(selectedGrade) : "전체"}
            category={selectedCategory ?? "전체"}
            query={query}
            browsableCourses={browsableCourses}
            browsableTotalCount={browsableTotalCount}
            browsableTotalPages={browsableTotalPages}
            page={currentPage}
            viewerDepartment={myDepartment}
          />
        </div>
      </main>
    </div>
  )
}
