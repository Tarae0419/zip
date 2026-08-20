import { describe, expect, it } from "vitest"
import { summarizeEnrollmentTrend } from "./trend"

describe("summarizeEnrollmentTrend", () => {
  it("두 학기 이상이면 변화량과 최고 학기를 계산한다", () => {
    const summary = summarizeEnrollmentTrend([
      { semester: "2025-2", enrolledCount: 40, capacity: 50, sectionCount: 1 },
      { semester: "2026-1", enrolledCount: 65, capacity: 80, sectionCount: 2 },
    ])
    expect(summary).toContain("25명 증가")
    expect(summary).toContain("2026-1의 65명")
  })
  it("한 학기 데이터로 추세를 단정하지 않는다", () => {
    expect(summarizeEnrollmentTrend([{ semester: "2026-1", enrolledCount: 20, capacity: null, sectionCount: 1 }])).toContain("판단하지 않았어요")
  })
})
