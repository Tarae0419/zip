export type PortfolioItemCategory = "프로젝트" | "자격증" | "대외활동" | "수업" | "기타"
export type PortfolioItemStatus = "계획" | "진행 중" | "완료"

export type PortfolioItem = {
  id: string
  grade: number
  title: string
  category: PortfolioItemCategory
  status: PortfolioItemStatus
  goal: string
  period: string
  role: string
  skills: string
  result: string
  link: string
  reflection: string
  source: "직접 추가" | "커리큘럼 가져오기"
}

export type PortfolioData = {
  version: 1
  visibility: "private" | "link"
  items: PortfolioItem[]
  updatedAt: string
}
