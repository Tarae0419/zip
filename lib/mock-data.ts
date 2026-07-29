// 모든 데이터는 목업(mock)입니다. 실제 DB/API 연동은 이후 IDE 단계에서 진행합니다.

export type Requirement = "전공필수" | "전공선택" | "교양"

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

// 공통 목업 과목 데이터 — 여러 화면에서 일관되게 사용
export const mockCourses: Course[] = [
  {
    id: "calculus-1",
    name: "미적분학1",
    department: "수학과",
    professor: "김도현 교수",
    credits: 3,
    requirement: "전공필수",
    rating: 4.2,
    reviewCount: 87,
    hashtags: [
      { tag: "과제많음", percent: 72 },
      { tag: "설명잘함", percent: 65 },
      { tag: "학점짜게줌", percent: 58 },
    ],
    academicField: "수학/컴퓨터공학",
    summary:
      "미적분학1은 극한과 연속, 미분과 적분의 기초를 다루는 수학과 전공필수 과목입니다. 수강생들은 교수님의 설명이 명확하고 개념 이해에 큰 도움이 된다고 평가합니다. 다만 매주 과제 분량이 많은 편이라 꾸준한 복습이 필요하며, 학점은 다소 짜게 주는 경향이 있으니 시험 대비를 철저히 하는 것을 추천합니다.",
  },
  {
    id: "linear-algebra",
    name: "선형대수학",
    department: "수학과",
    professor: "이서연 교수",
    credits: 3,
    requirement: "전공선택",
    rating: 4.5,
    reviewCount: 52,
    hashtags: [
      { tag: "꿀강의", percent: 80 },
      { tag: "팀플없음", percent: 70 },
    ],
    academicField: "수학/컴퓨터공학",
    summary:
      "선형대수학은 벡터, 행렬, 선형변환을 다루는 과목으로 이공계 전반의 기초가 됩니다. 팀플이 없고 부담이 적어 '꿀강의'로 자주 언급됩니다. 개념 위주로 차근차근 진행되어 부담 없이 좋은 학점을 받기 좋은 과목으로 평가받습니다.",
  },
  {
    id: "semiconductor-process",
    name: "반도체공정개론",
    department: "화학공학과",
    professor: "박지훈 교수",
    credits: 3,
    requirement: "전공선택",
    rating: 3.9,
    reviewCount: 34,
    hashtags: [
      { tag: "실무중심", percent: 75 },
      { tag: "과제많음", percent: 60 },
    ],
    industry: "반도체",
    summary:
      "반도체공정개론은 반도체 제조의 전체 공정 흐름을 실무 관점에서 소개하는 과목입니다. 현업 사례가 많아 진로를 반도체로 잡은 학생들에게 특히 유용합니다. 다만 과제 분량이 있는 편이라 성실한 참여가 필요합니다.",
  },
  {
    id: "semiconductor-device",
    name: "반도체소자",
    department: "전자공학과",
    professor: "최민수 교수",
    credits: 3,
    requirement: "전공필수",
    rating: 4.0,
    reviewCount: 45,
    hashtags: [
      { tag: "시험어려움", percent: 68 },
      { tag: "교수님친절", percent: 72 },
    ],
    industry: "반도체",
    summary:
      "반도체소자는 PN 접합, 트랜지스터 등 소자의 동작 원리를 다루는 전자공학과 전공필수 과목입니다. 교수님이 질문에 친절하게 답해주셔서 이해에 도움이 된다는 평이 많습니다. 시험 난이도가 높은 편이므로 개념을 탄탄히 다지는 것이 중요합니다.",
  },
  {
    id: "data-structure",
    name: "데이터구조",
    department: "컴퓨터공학과",
    professor: "정하늘 교수",
    credits: 3,
    requirement: "전공필수",
    rating: 3.7,
    reviewCount: 60,
    hashtags: [
      { tag: "과제많음", percent: 80 },
      { tag: "팀플많음", percent: 55 },
    ],
    academicField: "수학/컴퓨터공학",
    summary:
      "데이터구조는 배열, 스택, 큐, 트리, 그래프 등 핵심 자료구조를 구현하며 배우는 컴퓨터공학과 전공필수 과목입니다. 실습 과제와 팀 프로젝트 비중이 높아 코딩 실력을 기르기 좋지만 그만큼 시간 투자가 필요합니다. 개발 직군을 목표로 한다면 반드시 탄탄히 다져야 할 과목입니다.",
  },
]

export function getCourseById(id: string): Course | undefined {
  return mockCourses.find((c) => c.id === id)
}

// 홈 인기 분야 태그
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

// 분야로 찾기 화면
export type FieldCategory = {
  id: string
  name: string
  icon: string
  courseCount: number
  description: string
  courseIds: string[]
}

export const fieldCategories: FieldCategory[] = [
  {
    id: "semiconductor",
    name: "반도체",
    icon: "Cpu",
    courseCount: 24,
    description: "공정·소자·회로 설계까지 반도체 산업 전반",
    courseIds: ["semiconductor-process", "semiconductor-device", "linear-algebra"],
  },
  {
    id: "ai-data",
    name: "AI·데이터사이언스",
    icon: "BrainCircuit",
    courseCount: 31,
    description: "머신러닝, 통계, 데이터 분석의 기초와 응용",
    courseIds: ["data-structure", "linear-algebra", "calculus-1"],
  },
  {
    id: "bio-health",
    name: "바이오·헬스케어",
    icon: "HeartPulse",
    courseCount: 18,
    description: "생명공학과 디지털 헬스케어 융합 과목",
    courseIds: ["calculus-1"],
  },
  {
    id: "finance-fintech",
    name: "금융·핀테크",
    icon: "LineChart",
    courseCount: 22,
    description: "금융공학, 계량분석, 핀테크 서비스 설계",
    courseIds: ["calculus-1", "linear-algebra", "data-structure"],
  },
  {
    id: "content-media",
    name: "콘텐츠·미디어",
    icon: "Clapperboard",
    courseCount: 15,
    description: "미디어 기획, 인터랙션, 콘텐츠 기술",
    courseIds: ["data-structure"],
  },
  {
    id: "energy-env",
    name: "에너지·환경",
    icon: "Leaf",
    courseCount: 12,
    description: "신재생 에너지와 지속가능성 관련 과목",
    courseIds: ["semiconductor-process"],
  },
]

// 과목 상세 - 개별 수강평
export const mockReviews: Record<string, Review[]> = {
  "calculus-1": [
    {
      id: "r1",
      rating: 4,
      semester: "2025-1학기",
      body: "개념 설명이 정말 깔끔해서 고등학교 때 대충 넘어갔던 부분까지 확실히 이해됐어요. 다만 매주 나오는 과제가 은근히 시간을 많이 잡아먹습니다. 미리미리 하는 걸 추천!",
      hashtags: ["설명잘함", "과제많음"],
    },
    {
      id: "r2",
      rating: 5,
      semester: "2024-2학기",
      body: "교수님이 질문을 정말 잘 받아주십니다. 이해가 안 되는 부분을 물어보면 다양한 예시로 설명해주셔서 좋았어요. 시험은 평이한 편이었습니다.",
      hashtags: ["설명잘함", "교수님친절"],
    },
    {
      id: "r3",
      rating: 3,
      semester: "2024-2학기",
      body: "내용 자체는 좋은데 학점을 정말 짜게 주십니다. A 받으려면 시험을 거의 완벽하게 봐야 해요. 과제 성실히 하고 시험 대비 철저히 하세요. 그래도 배우는 건 확실히 많습니다. 수학 기초를 제대로 다지고 싶다면 추천합니다.",
      hashtags: ["학점짜게줌", "과제많음"],
    },
  ],
  "linear-algebra": [
    {
      id: "r1",
      rating: 5,
      semester: "2025-1학기",
      body: "진짜 꿀강의입니다. 팀플도 없고 진도도 적당해서 부담 없이 들었어요. 개념 위주라 시험도 무난했습니다.",
      hashtags: ["꿀강의", "팀플없음"],
    },
    {
      id: "r2",
      rating: 4,
      semester: "2024-2학기",
      body: "행렬 계산이 처음엔 헷갈렸지만 반복하다 보니 익숙해졌어요. 이공계라면 기초로 꼭 들어두면 좋은 과목입니다.",
      hashtags: ["꿀강의"],
    },
  ],
  "semiconductor-process": [
    {
      id: "r1",
      rating: 4,
      semester: "2025-1학기",
      body: "현업 사례가 많아서 반도체 취업 준비하는 입장에서 큰 도움이 됐어요. 과제가 좀 있지만 실무 감각을 기를 수 있어서 만족합니다.",
      hashtags: ["실무중심", "과제많음"],
    },
    {
      id: "r2",
      rating: 4,
      semester: "2024-2학기",
      body: "공정 전체 흐름을 처음 잡기에 좋았습니다. 용어가 많아서 초반에 외울 게 조금 있어요.",
      hashtags: ["실무중심"],
    },
  ],
  "semiconductor-device": [
    {
      id: "r1",
      rating: 4,
      semester: "2025-1학기",
      body: "교수님이 정말 친절하세요. 소자 동작 원리가 어렵지만 질문하면 끝까지 설명해주십니다. 시험은 어려운 편이니 각오하세요.",
      hashtags: ["교수님친절", "시험어려움"],
    },
    {
      id: "r2",
      rating: 4,
      semester: "2024-2학기",
      body: "PN 접합부터 트랜지스터까지 탄탄하게 배웁니다. 개념을 확실히 잡아야 시험을 볼 수 있어요.",
      hashtags: ["시험어려움"],
    },
  ],
  "data-structure": [
    {
      id: "r1",
      rating: 4,
      semester: "2025-1학기",
      body: "코딩 실력이 확실히 늘어요. 대신 과제가 많고 팀 프로젝트도 있어서 시간 투자가 필요합니다. 개발자 준비한다면 무조건 열심히 들으세요.",
      hashtags: ["과제많음", "팀플많음"],
    },
    {
      id: "r2",
      rating: 3,
      semester: "2024-2학기",
      body: "내용은 정말 중요한데 매주 과제가 부담됐습니다. 팀원 잘 만나는 게 중요해요.",
      hashtags: ["과제많음", "팀플많음"],
    },
  ],
}

export function getReviewsByCourseId(id: string): Review[] {
  return mockReviews[id] ?? []
}

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

// AI 추천 태그 (회색 톤)
export const aiSuggestedTags: string[] = ["개념중심", "복습필수", "실습위주"]

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
