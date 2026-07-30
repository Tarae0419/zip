import { AppHeader } from "@/components/app-header"
import { CurriculumPlanner } from "@/components/curriculum-planner"
import { getAnonId } from "@/lib/auth/anon-user"
import {
  getCoursesByCodes,
  getCurriculumDepartments,
  getCurriculumForDepartment,
  getDistinctDepartments,
  getIndustryFields,
  getUserDepartment,
} from "@/lib/db/queries"

export default async function CurriculumPage() {
  const anonId = await getAnonId()

  const [curriculumDepartments, allDepartments, industryFields, myDepartment] = await Promise.all([
    getCurriculumDepartments(),
    getDistinctDepartments(),
    getIndustryFields(),
    getUserDepartment(anonId),
  ])

  const requiredCoursesByDepartment: Record<string, { code: string; name: string; credits: number }[]> = {}
  for (const department of curriculumDepartments) {
    const curriculum = await getCurriculumForDepartment(department)
    if (!curriculum) continue
    const required = await getCoursesByCodes(curriculum.requiredCourseCodes as string[])
    requiredCoursesByDepartment[department] = required.map((c) => ({ code: c.code, name: c.name, credits: c.credits }))
  }

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            AI 커리큘럼 설계
          </h1>
          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            학과, 이수 현황, 관심 분야를 입력하면 졸업까지의 학기별 수강 계획을
            AI가 제안해드려요.
          </p>
        </div>

        <div className="mt-8">
          <CurriculumPlanner
            curriculumDepartments={curriculumDepartments}
            allDepartments={allDepartments}
            requiredCoursesByDepartment={requiredCoursesByDepartment}
            interestFields={industryFields}
            myDepartment={myDepartment}
          />
        </div>
      </main>
    </div>
  )
}
