import { describe, expect, it } from "vitest"
import { reconcileAiPlacements } from "./reconcile-ai-plan"
import type { RequiredGroup } from "./plan"
import type { AiCandidateCourse, AiPlacement } from "./ai-plan-types"
import type { RequiredCourseInfo } from "@/lib/db/queries"

function permissiveGrades(count: number): number[] {
  return Array(count).fill(4)
}

function requiredCourse(overrides: Partial<RequiredCourseInfo> & Pick<RequiredCourseInfo, "code" | "name">): RequiredCourseInfo {
  return {
    courseId: `id-${overrides.code}`,
    credits: 3,
    department: "테스트학과",
    prerequisiteCodes: [],
    grade: null,
    ...overrides,
  }
}

function aiCandidate(overrides: Partial<AiCandidateCourse> & Pick<AiCandidateCourse, "courseCode" | "name">): AiCandidateCourse {
  return {
    courseId: `id-${overrides.courseCode}`,
    department: "테스트학과",
    credits: 3,
    category: "관심분야",
    requirementType: "관심분야",
    prerequisiteCodes: [],
    grade: null,
    isOwnMajor: true,
    relevanceScore: 0.5,
    matchedIndustryTagId: null,
    ...overrides,
  }
}

function placement(courseCode: string, semesterIndex: number, reason = "테스트 사유"): AiPlacement {
  return { courseCode, semesterIndex, reason }
}

describe("reconcileAiPlacements", () => {
  it("force-places a required course the AI omitted, so it appears exactly once", () => {
    const req1 = requiredCourse({ code: "REQ1", name: "필수1" })
    const req2 = requiredCourse({ code: "REQ2", name: "필수2" })
    const requiredGroups: RequiredGroup[] = [{ courses: [req1, req2], type: "전공필수" }]
    const candidatesByCode = new Map([
      ["REQ1", aiCandidate({ courseCode: "REQ1", name: "필수1", category: "전공필수" })],
      ["REQ2", aiCandidate({ courseCode: "REQ2", name: "필수2", category: "전공필수" })],
    ])

    const result = reconcileAiPlacements({
      placements: [placement("REQ1", 0)], // REQ2를 AI가 빠뜨림
      requiredGroups,
      candidatesByCode,
      remainingSemesters: 3,
      semesterGrades: permissiveGrades(3),
    })

    const flat = result.semesterItems.flat()
    expect(flat.filter((i) => i.courseCode === "REQ1")).toHaveLength(1)
    expect(flat.filter((i) => i.courseCode === "REQ2")).toHaveLength(1)
    expect(result.repairNotes.some((n) => n.includes("보완"))).toBe(true)
  })

  it("moves a course placed before its prerequisite to a later semester", () => {
    const a = requiredCourse({ code: "A", name: "A과목" })
    const b = requiredCourse({ code: "B", name: "B과목", prerequisiteCodes: ["A"] })
    const requiredGroups: RequiredGroup[] = [{ courses: [a, b], type: "전공필수" }]
    const candidatesByCode = new Map([
      ["A", aiCandidate({ courseCode: "A", name: "A과목", category: "전공필수" })],
      ["B", aiCandidate({ courseCode: "B", name: "B과목", category: "전공필수", prerequisiteCodes: ["A"] })],
    ])

    // AI가 순서를 거꾸로 배치: A는 1번째 학기(마지막 학기 아님, 뒤로 밀 여유 있음), B(선수과목 A 필요)는 0번째 학기
    const result = reconcileAiPlacements({
      placements: [placement("A", 1), placement("B", 0)],
      requiredGroups,
      candidatesByCode,
      remainingSemesters: 3,
      semesterGrades: permissiveGrades(3),
    })

    const semesterOf = (code: string) => result.semesterItems.findIndex((items) => items.some((i) => i.courseCode === code))
    expect(semesterOf("B")).toBeGreaterThan(semesterOf("A"))
  })

  it("collapses a duplicate courseCode in placements to a single placement", () => {
    const candidatesByCode = new Map([["E1", aiCandidate({ courseCode: "E1", name: "선택1" })]])

    const result = reconcileAiPlacements({
      placements: [placement("E1", 0), placement("E1", 1)],
      requiredGroups: [],
      candidatesByCode,
      remainingSemesters: 2,
      semesterGrades: permissiveGrades(2),
    })

    const flat = result.semesterItems.flat()
    expect(flat.filter((i) => i.courseCode === "E1")).toHaveLength(1)
  })

  it("trims lowest-relevance electives to satisfy the 18-credit cap while keeping required courses", () => {
    const req = requiredCourse({ code: "REQ", name: "필수", credits: 12 })
    const requiredGroups: RequiredGroup[] = [{ courses: [req], type: "전공필수" }]
    const candidatesByCode = new Map([
      ["REQ", aiCandidate({ courseCode: "REQ", name: "필수", category: "전공필수", credits: 12 })],
      ["E1", aiCandidate({ courseCode: "E1", name: "선택1", credits: 6, relevanceScore: 0.9 })],
      ["E2", aiCandidate({ courseCode: "E2", name: "선택2", credits: 6, relevanceScore: 0.1 })],
    ])

    const result = reconcileAiPlacements({
      placements: [placement("REQ", 0), placement("E1", 0), placement("E2", 0)],
      requiredGroups,
      candidatesByCode,
      remainingSemesters: 1,
      semesterGrades: permissiveGrades(1),
    })

    expect(result.semesterCredits[0]).toBeLessThanOrEqual(18)
    expect(result.semesterItems[0].some((i) => i.courseCode === "REQ")).toBe(true)
    expect(result.semesterItems[0].some((i) => i.courseCode === "E2")).toBe(false) // 연관도 낮은 쪽부터 드롭
    expect(result.semesterItems[0].some((i) => i.courseCode === "E1")).toBe(true)
    expect(result.repairNotes.some((n) => n.includes("상한"))).toBe(true)
  })

  it("silently ignores a placement whose courseCode is not in the candidate pool", () => {
    const candidatesByCode = new Map([["E1", aiCandidate({ courseCode: "E1", name: "선택1" })]])

    const result = reconcileAiPlacements({
      placements: [placement("E1", 0), placement("GHOST", 0)],
      requiredGroups: [],
      candidatesByCode,
      remainingSemesters: 1,
      semesterGrades: permissiveGrades(1),
    })

    const flat = result.semesterItems.flat()
    expect(flat.map((i) => i.courseCode)).toEqual(["E1"])
  })

  it("terminates without hanging when prerequisites form a cycle", () => {
    const candidatesByCode = new Map([
      ["A", aiCandidate({ courseCode: "A", name: "A과목", category: "전공필수", prerequisiteCodes: ["B"] })],
      ["B", aiCandidate({ courseCode: "B", name: "B과목", category: "전공필수", prerequisiteCodes: ["A"] })],
    ])
    const requiredGroups: RequiredGroup[] = [
      { courses: [requiredCourse({ code: "A", name: "A과목", prerequisiteCodes: ["B"] }), requiredCourse({ code: "B", name: "B과목", prerequisiteCodes: ["A"] })], type: "전공필수" },
    ]

    const result = reconcileAiPlacements({
      placements: [placement("A", 0), placement("B", 1)],
      requiredGroups,
      candidatesByCode,
      remainingSemesters: 2,
      semesterGrades: permissiveGrades(2),
    })

    const flat = result.semesterItems.flat()
    expect(flat.filter((i) => i.courseCode === "A")).toHaveLength(1)
    expect(flat.filter((i) => i.courseCode === "B")).toHaveLength(1)
    for (const idx of result.semesterItems.map((_, i) => i)) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(2)
    }
  })
})
