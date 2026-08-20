import { describe, expect, it } from "vitest"
import { sanitizePortfolioData } from "./storage"

describe("sanitizePortfolioData", () => {
  it("손상된 항목을 제외하고 공개 범위를 보수적으로 정규화한다", () => {
    const result = sanitizePortfolioData({
      version: 1,
      visibility: "public",
      items: [
        { id: "1", title: "프로젝트", grade: 8, category: "프로젝트", status: "완료", source: "커리큘럼 가져오기" },
        { id: "2", title: "" },
      ],
    })
    expect(result?.visibility).toBe("private")
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].grade).toBe(4)
  })

  it("지원하지 않는 버전은 거부한다", () => {
    expect(sanitizePortfolioData({ version: 2, items: [] })).toBeNull()
  })
})
