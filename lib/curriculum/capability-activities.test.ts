import { describe, expect, it } from "vitest"
import { buildFallbackCapabilityActivities, sanitizeCapabilityActivities } from "./capability-activities"

describe("capability activities", () => {
  it("현재 학년부터 4학년까지 기본 활동을 만든다", () => {
    const activities = buildFallbackCapabilityActivities({ grade: 3, department: "컴퓨터공학", careerKeyword: "AI 엔지니어", interestFieldNames: [] })
    expect(activities).toHaveLength(4)
    expect(new Set(activities.map((item) => item.grade))).toEqual(new Set([3, 4]))
    expect(activities.every((item) => item.sourceType === "기본 제안")).toBe(true)
  })

  it("허용되지 않은 AI 항목과 이전 학년 항목을 제거한다", () => {
    const activities = sanitizeCapabilityActivities([
      { grade: 1, title: "과거", category: "프로젝트", expectedCapability: "역량", reason: "이유", evidenceBasis: "근거", confidence: "높음" },
      { grade: 3, title: "유효", category: "프로젝트", expectedCapability: "역량", reason: "이유", evidenceBasis: "근거", confidence: "보통" },
      { grade: 3, title: "무효", category: "알 수 없음", expectedCapability: "역량", reason: "이유", evidenceBasis: "근거", confidence: "보통" },
    ], 2)
    expect(activities).toHaveLength(1)
    expect(activities[0].title).toBe("유효")
  })
})
