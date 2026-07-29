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
  // "2026-1" | "2026-2" 형태 — 같은 과목명이 학기마다 다른 courses row(= 다른 스케줄)로 존재하므로,
  // 검색 결과에서 어느 학기 개설분인지 구분하고 학기별로 필터링하는 데 쓴다.
  semester: string
}

export type Review = {
  id: string
  rating: number
  semester: string
  body: string
  hashtags: string[]
}
