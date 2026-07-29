// F1/F2/F3/F4 모두 실제 DB 연동으로 전환됨. 이 파일에는 DB에 담기 부적절한 정적 UI 카피만 남아 있다.
import type { Requirement, HashtagStat, Course, Review } from "./types"
export type { Requirement, HashtagStat, Course, Review }

// 홈 인기 분야 태그(검색 제안용 — DB의 industry_tags와는 별개로 유지되는 UI 카피)
export const popularTags: string[] = [
  "수학",
  "반도체",
  "데이터사이언스",
  "금융",
  "바이오",
  "AI",
  "콘텐츠",
  "에너지",
]

// 수강평 작성 모달용 사전 정의 해시태그 (F1의 실제 태그 taxonomy — mock 아님, 역사적 이유로 여기 위치)
export const predefinedReviewTags: string[] = [
  "꿀강의",
  "널널함",
  "과제많음",
  "팀플많음",
  "출석중요",
  "시험어려움",
  "교수님친절",
  "실무중심",
  "재수강비추",
]
