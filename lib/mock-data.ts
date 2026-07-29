// F1/F2(과목·리뷰)·F3(분야 탐색)는 실제 DB 연동으로 교체됨 — app/page.tsx, app/search/page.tsx,
// app/courses/[id]/page.tsx, app/fields/page.tsx는 더 이상 이 파일의 과목/리뷰 데이터를 쓰지 않는다.
// F4(커리큘럼 추천)는 curricula 졸업요건 데이터가 아직 없어(학과 요건 데이터 미확보, Sprint 5) 당분간 이 목업을 계속 사용한다.
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

// 수강평 작성 모달용 사전 정의 해시태그
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

// 커리큘럼 설계 - 학과 목록
export const departments: string[] = [
  "수학과",
  "컴퓨터공학과",
  "전자공학과",
  "화학공학과",
  "경영학과",
  "생명공학과",
]

export const interestFields: string[] = [
  "반도체",
  "AI·데이터사이언스",
  "바이오·헬스케어",
  "금융·핀테크",
  "콘텐츠·미디어",
  "에너지·환경",
]

// 커리큘럼 추천 결과 (목업)
export type CurriculumItem = {
  name: string
  credits: number
  type: "전공필수" | "전공선택" | "관심분야"
  reason: string
}

export type CurriculumSemester = {
  label: string
  totalCredits: number
  items: CurriculumItem[]
}

export const mockCurriculum: CurriculumSemester[] = [
  {
    label: "3학기",
    totalCredits: 16,
    items: [
      {
        name: "자료구조",
        credits: 3,
        type: "전공필수",
        reason: "전공 이수 로드맵상 3학기에 반드시 들어야 하는 기반 과목입니다.",
      },
      {
        name: "선형대수학",
        credits: 3,
        type: "전공선택",
        reason: "AI·데이터사이언스 분야의 필수 수학 기초로, 후속 과목 이해에 도움이 됩니다.",
      },
      {
        name: "반도체공정개론",
        credits: 3,
        type: "관심분야",
        reason: "선택하신 '반도체' 관심 분야와 연관도가 높은 실무 중심 과목입니다.",
      },
      {
        name: "확률과통계",
        credits: 3,
        type: "전공선택",
        reason: "데이터 분석의 기초가 되며 다양한 후속 전공과 연결됩니다.",
      },
      {
        name: "대학영어",
        credits: 2,
        type: "관심분야",
        reason: "졸업 요건 충족과 전공 원서 학습을 위해 이번 학기 배치했습니다.",
      },
    ],
  },
  {
    label: "4학기",
    totalCredits: 15,
    items: [
      {
        name: "알고리즘",
        credits: 3,
        type: "전공필수",
        reason: "자료구조 이수 후 자연스럽게 이어지는 핵심 전공필수 과목입니다.",
      },
      {
        name: "반도체소자",
        credits: 3,
        type: "관심분야",
        reason: "반도체 분야 심화 과목으로 진로 연관도가 매우 높습니다.",
      },
      {
        name: "운영체제",
        credits: 3,
        type: "전공선택",
        reason: "시스템 이해도를 높여 전공 심화 과목의 기초가 됩니다.",
      },
      {
        name: "머신러닝기초",
        credits: 3,
        type: "관심분야",
        reason: "AI·데이터사이언스 관심 분야의 진입 과목으로 추천합니다.",
      },
      {
        name: "기술글쓰기",
        credits: 3,
        type: "전공선택",
        reason: "프로젝트 문서화와 커뮤니케이션 역량을 기르기 위한 과목입니다.",
      },
    ],
  },
  {
    label: "5학기",
    totalCredits: 15,
    items: [
      {
        name: "캡스톤디자인1",
        credits: 3,
        type: "전공필수",
        reason: "졸업 프로젝트의 시작 단계로 5학기 이수를 권장합니다.",
      },
      {
        name: "임베디드시스템",
        credits: 3,
        type: "관심분야",
        reason: "반도체와 소프트웨어를 잇는 과목으로 관심 분야 심화에 적합합니다.",
      },
      {
        name: "딥러닝",
        credits: 3,
        type: "관심분야",
        reason: "머신러닝기초 이수 후 이어지는 AI 심화 과목입니다.",
      },
      {
        name: "데이터베이스",
        credits: 3,
        type: "전공선택",
        reason: "실무에서 폭넓게 쓰이는 데이터 관리 역량을 기릅니다.",
      },
      {
        name: "진로세미나",
        credits: 3,
        type: "전공선택",
        reason: "졸업 후 진로 설계를 구체화하는 데 도움이 되는 과목입니다.",
      },
    ],
  },
]
