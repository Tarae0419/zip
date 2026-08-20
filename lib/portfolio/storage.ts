import type { PortfolioData, PortfolioItem, PortfolioItemCategory, PortfolioItemStatus } from "./types"

export const PORTFOLIO_STORAGE_KEY = "portfolio-v1"

const categories = new Set<PortfolioItemCategory>(["프로젝트", "자격증", "대외활동", "수업", "기타"])
const statuses = new Set<PortfolioItemStatus>(["계획", "진행 중", "완료"])

export function createEmptyPortfolioItem(grade = 1): PortfolioItem {
  return {
    id: crypto.randomUUID(),
    grade,
    title: "새 포트폴리오 활동",
    category: "프로젝트",
    status: "계획",
    goal: "",
    period: "",
    role: "",
    skills: "",
    result: "",
    link: "",
    reflection: "",
    source: "직접 추가",
  }
}

export function sanitizePortfolioData(value: unknown): PortfolioData | null {
  if (typeof value !== "object" || value === null) return null
  const data = value as Record<string, unknown>
  if (data.version !== 1 || !Array.isArray(data.items)) return null
  const items: PortfolioItem[] = []
  for (const raw of data.items) {
    if (typeof raw !== "object" || raw === null) continue
    const item = raw as Record<string, unknown>
    if (typeof item.id !== "string" || typeof item.title !== "string" || !item.title.trim()) continue
    const grade = typeof item.grade === "number" ? Math.max(1, Math.min(4, Math.round(item.grade))) : 1
    const category = categories.has(item.category as PortfolioItemCategory) ? item.category as PortfolioItemCategory : "기타"
    const status = statuses.has(item.status as PortfolioItemStatus) ? item.status as PortfolioItemStatus : "계획"
    const text = (key: string, max: number) => typeof item[key] === "string" ? item[key].slice(0, max) : ""
    items.push({
      id: item.id,
      grade,
      title: item.title.trim().slice(0, 100),
      category,
      status,
      goal: text("goal", 500),
      period: text("period", 100),
      role: text("role", 300),
      skills: text("skills", 300),
      result: text("result", 500),
      link: text("link", 500),
      reflection: text("reflection", 1000),
      source: item.source === "커리큘럼 가져오기" ? "커리큘럼 가져오기" : "직접 추가",
    })
  }
  return {
    version: 1,
    visibility: data.visibility === "link" ? "link" : "private",
    items: items.slice(0, 100),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  }
}
