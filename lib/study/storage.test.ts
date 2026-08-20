import { describe, expect, it } from "vitest"
import { hasEnoughStudyEvidence, sanitizeStudyHubData } from "./storage"

describe("study hub storage", () => {
  it("과목·학기 중복을 제거하고 질문을 검증한다", () => {
    const result = sanitizeStudyHubData({ version: 1, records: [
      { courseId: "a", courseName: "A", semester: "2026-1", interviewQuestions: [{ question: "Q", intent: "I", evidence: "E" }] },
      { courseId: "a", courseName: "A2", semester: "2026-1" },
    ] })
    expect(result?.records).toHaveLength(1)
    expect(result?.records[0].interviewQuestions).toHaveLength(1)
  })

  it("근거 텍스트가 너무 짧으면 AI 생성을 허용하지 않는다", () => {
    expect(hasEnoughStudyEvidence({ objective: "짧음", weeklyNotes: "", assignments: "", exams: "" })).toBe(false)
    expect(hasEnoughStudyEvidence({ objective: "", weeklyNotes: "자료구조의 배열, 연결 리스트, 스택, 큐를 예제와 함께 학습하고 구현했다.", assignments: "", exams: "" })).toBe(true)
  })
})
