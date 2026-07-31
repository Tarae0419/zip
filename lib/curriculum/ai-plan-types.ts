// F4 AI 커리큘럼 설계(lib/ai/curriculum-planner.ts)와 그 결과를 검증·보정하는
// lib/curriculum/reconcile-ai-plan.ts가 공유하는 내부 계약 타입.
// lib/curriculum/types.ts(UI 계약)와는 분리한다 — 그쪽은 변경하지 않는다.
import type { PlanItemType } from "./types"

export type AiCandidateCourse = {
  courseCode: string
  courseId: string
  name: string
  department: string
  credits: number
  // 조회 출처(전공필수/전공선택/관심분야)로 서버가 이미 결정한 값 — 모델에게는
  // 참고용으로만 전달하고, 응답에서 되읽지 않는다(신뢰 표면적 최소화).
  category: PlanItemType
  // 실제 이수구분(전공선택/교양/전공필수 등). category는 계획상의 역할(예: "관심분야" 슬롯을
  // 채우는 용도)일 뿐이라, "전공선택 학점으로 인정된다"처럼 credit 인정 여부를 정확히 말하려면
  // 이 실제 이수구분이 필요하다 — 예를 들어 교양 과목도 category는 "관심분야"로 오지만
  // requirementType은 "교양"이라 전공선택 학점 인정 문구를 쓰면 안 된다.
  requirementType: string
  prerequisiteCodes: string[]
  grade: number | null
  isOwnMajor: boolean
  relevanceScore: number | null
  matchedIndustryTagId: string | null
}

export type AiPlanRequest = {
  remainingSemesters: number
  semesterLabels: string[]
  semesterGrades: number[]
  interestFieldNames: string[]
  totalRemainingCreditsNeeded: number
  electiveMinCreditsRemaining: number
  // own+double 전공필수 코드(excludeSet 반영 후) — 전부 빠짐없이 배치돼야 한다.
  requiredCourseCodes: string[]
  candidates: AiCandidateCourse[]
}

export type AiPlacement = { courseCode: string; semesterIndex: number; reason: string }
