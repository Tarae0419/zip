import { describe, expect, it } from "vitest"
import type { CartCourse } from "./types"
import { estimateScheduleWalkMinutes, evaluateSchedulePreferences, generateScheduleCandidates, satisfiesHardPreferences, validateScheduleCourses } from "./preferences"

function course(id: string, timeSlots: string): CartCourse {
  return {
    id,
    name: id,
    department: "테스트학과",
    professor: "교수",
    credits: 3,
    code: id,
    semester: "2026-2",
    classroom: null,
    timeSlots,
  }
}

describe("evaluateSchedulePreferences", () => {
  it("오전 수업 비율과 희망 공강을 함께 점수화한다", () => {
    const result = evaluateSchedulePreferences(
      [course("A", "월 1-A"), course("B", "화 5-A")],
      { timePreference: "morning", preferredFreeDays: ["금"] },
    )

    expect(result.score).toBe(70)
    expect(result.matchedSessions).toBe(1)
    expect(result.achievedFreeDays).toEqual(["금"])
  })

  it("수업이 있는 요일은 공강 미충족으로 반환한다", () => {
    const result = evaluateSchedulePreferences(
      [course("A", "수 2-A")],
      { timePreference: "any", preferredFreeDays: ["수", "금"] },
    )

    expect(result.score).toBe(80)
    expect(result.missedFreeDays).toEqual(["수"])
    expect(result.achievedFreeDays).toEqual(["금"])
  })

  it("선호 조건이 없으면 현재 시간표를 100점으로 평가한다", () => {
    const result = evaluateSchedulePreferences(
      [course("A", "목 8-A")],
      { timePreference: "any", preferredFreeDays: [] },
    )

    expect(result.score).toBe(100)
  })

  it("충돌 없는 분반 조합 중 선호 점수가 높은 후보를 우선한다", () => {
    const candidates = generateScheduleCandidates(
      [
        [course("A-오전", "월 1-A"), course("A-오후", "월 6-A")],
        [course("B-오전", "화 2-A"), course("B-오후", "화 7-A")],
      ],
      { timePreference: "afternoon", preferredFreeDays: [] },
    )

    expect(candidates[0].score).toBe(100)
    expect(candidates[0].courses.map((item) => item.id)).toEqual(["A-오후", "B-오후"])
  })

  it("시간이 겹치는 조합은 후보에서 제외한다", () => {
    const candidates = generateScheduleCandidates(
      [[course("A", "월 1-A")], [course("B", "월 1-B"), course("C", "화 1-A")]],
      { timePreference: "any", preferredFreeDays: [] },
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0].courses.map((item) => item.id)).toEqual(["A", "C"])
  })

  it("연속 수업의 건물이 다르면 이동시간을 합산한다", () => {
    const first = { ...course("A", "월 1-A"), classroom: "전주:공과대학 8호관 402" }
    const second = { ...course("B", "월 2-A"), classroom: "전주:중앙도서관 101" }
    expect(estimateScheduleWalkMinutes([first, second])).toBeGreaterThan(0)
  })

  it("선수과목 동시 수강과 학년 제한 가능성을 경고한다", () => {
    const prerequisite = course("PRE", "월 1-A")
    const advanced = {
      ...course("ADV", "화 1-A"),
      prerequisiteCodes: ["PRE"],
      targetStudents: "3학년",
    }
    const issues = validateScheduleCourses([prerequisite, advanced], { grade: 2, completedCourseCodes: [] })
    expect(issues).toContain("ADV: 선수과목 PRE을(를) 같은 학기에 담을 수 없어요.")
    expect(issues.some((issue) => issue.includes("수강 대상"))).toBe(true)
  })

  it("수업 가능 시간과 학점 범위를 벗어난 조합을 거른다", () => {
    const morning = course("MORNING", "월 1-A")
    const afternoon = course("AFTERNOON", "화 6-A")
    expect(satisfiesHardPreferences([morning], { timePreference: "any", preferredFreeDays: [], allowedStartMinutes: 12 * 60 })).toBe(false)
    expect(satisfiesHardPreferences([afternoon], { timePreference: "any", preferredFreeDays: [], minCredits: 3, maxCredits: 3 })).toBe(true)
    expect(satisfiesHardPreferences([afternoon], { timePreference: "any", preferredFreeDays: [], minCredits: 6 })).toBe(false)
  })

  it("자동 후보 생성에서 허용 시간 밖 분반을 제외한다", () => {
    const candidates = generateScheduleCandidates(
      [[course("오전", "월 1-A"), course("오후", "월 6-A")]],
      { timePreference: "any", preferredFreeDays: [], allowedStartMinutes: 12 * 60 },
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0].courses[0].id).toBe("오후")
  })
})
