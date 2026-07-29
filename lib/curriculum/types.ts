// F4 커리큘럼 추천 결과 타입. curricula/courses row와는 별개로, 화면이 그대로 렌더링할 수 있는 형태로 둔다.

export type PlanItemType = "전공필수" | "복수전공필수" | "전공선택" | "관심분야"

export type PlanItem = {
  courseCode: string
  courseId: string
  name: string
  department: string
  credits: number
  type: PlanItemType
  reason: string
  isOwnMajor: boolean
  matchedIndustryTagId?: string
}

export type PlanSemester = {
  label: string
  totalCredits: number
  items: PlanItem[]
}

export type CurriculumPlanInput = {
  department: string
  doubleMajorDepartment?: string | null
  grade: number
  earnedCredits: number
  completedRequiredCourseCodes: string[]
  interestFieldIds: string[] // 우선순위 순서 (앞쪽이 더 높은 우선순위)
  remainingSemesters: number
  excludedCourseCodes: string[]
}

export type CurriculumPlanResult =
  | { status: "no_curriculum_data"; department: string }
  | {
      status: "ok"
      semesters: PlanSemester[]
      notes: string[]
    }
