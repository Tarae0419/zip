// 화면(컴포넌트)에서 쓰는 과목/리뷰 표현 타입.
// 실제 DB 컬럼(lib/db/schema.ts)과는 별개로 유지한다 — 화면은 이 타입에만 의존하고,
// lib/db/queries.ts가 DB row를 이 타입으로 변환하는 역할을 맡는다.

// courses.requirement_type과 동일한 값 집합(lib/db/schema.ts의 requirementTypeEnum 참고).
export type Requirement = "전공필수" | "전공선택" | "기초필수" | "계열공통" | "교양"

export type HashtagStat = {
  tag: string
  percent: number
}

export type Course = {
  id: string
  name: string
  department: string
  professor: string
  credits: number
  requirement: Requirement
  rating: number
  reviewCount: number
  hashtags: HashtagStat[]
  industry?: string
  academicField?: string
  summary: string
}

export type Review = {
  id: string
  rating: number
  semester: string
  body: string
  hashtags: string[]
}
