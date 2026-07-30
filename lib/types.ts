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
  // "화 6-A,화 6-B,..." 원문(lib/timetable/schedule.ts의 parseTimeSlots로 파싱) — 시간표에 담을 과목을
  // 고르는 화면(getCoursesForSemester)에서만 채워진다. 다른 목록 조회는 undefined로 둔다.
  timeSlots?: string | null
}

export type Review = {
  id: string
  rating: number
  semester: string
  body: string
  hashtags: string[]
  // 작성자 anonId를 그대로 내려주지 않고(다른 사용자 식별자 노출 방지), 조회 시점의 viewer와
  // 비교한 결과만 서버에서 계산해 내려준다 — 화면은 이 값으로 "내 리뷰"에만 삭제 버튼을 보여준다.
  isOwn: boolean
}
