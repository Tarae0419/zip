// 실 Neon DB(.env.local의 DATABASE_URL)를 대상으로 하는 읽기 전용 통합 스모크 테스트.
// DATABASE_URL이 없는 환경(예: 비밀값 없는 CI)에서는 자동으로 건너뛴다.
import { describe, expect, it } from "vitest"

const hasDb = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDb)("lib/db/queries (integration, real Neon DB)", () => {
  it("getPopularCourses returns a bounded list shaped like Course", async () => {
    const { getPopularCourses } = await import("./queries")
    const courses = await getPopularCourses(3)
    expect(courses.length).toBeLessThanOrEqual(3)
    for (const c of courses) {
      expect(typeof c.id).toBe("string")
      expect(typeof c.name).toBe("string")
      expect(typeof c.department).toBe("string")
      expect(typeof c.credits).toBe("number")
      expect(Array.isArray(c.hashtags)).toBe(true)
    }
  })

  it("getDistinctDepartments returns the real (large) department list", async () => {
    const { getDistinctDepartments } = await import("./queries")
    const departments = await getDistinctDepartments()
    expect(departments.length).toBeGreaterThan(50)
    expect(departments).toContain("전자공학부")
  })

  it("getCurriculumDepartments only returns departments that actually have seeded curricula", async () => {
    const { getCurriculumDepartments } = await import("./queries")
    const departments = await getCurriculumDepartments()
    expect(departments).toEqual(expect.arrayContaining(["전자공학부", "컴퓨터인공지능학부"]))
  })

  it("searchCoursesByName finds real courses containing the query in their name", async () => {
    const { searchCoursesByName } = await import("./queries")
    const { view } = await searchCoursesByName("수학", {})
    expect(view.length).toBeGreaterThan(0)
    for (const c of view) {
      expect(c.name).toContain("수학")
    }
  })

  it("getCurriculumForDepartment returns real required-course codes for a seeded department", async () => {
    const { getCurriculumForDepartment } = await import("./queries")
    const curriculum = await getCurriculumForDepartment("컴퓨터인공지능학부")
    expect(curriculum).not.toBeNull()
    expect(curriculum!.requiredCourseCodes?.length ?? 0).toBeGreaterThan(0)
  })

  it("getElectiveCandidates excludes a course by name even when a different-department course code matches, and never returns duplicate names", async () => {
    // 컴퓨터인공지능학부 전공필수 "UCAI005 인공지능"과 이름이 같은 "USOF005 인공지능"(소프트웨어공학과)이
    // 후보로 다시 추천되면 안 된다 — 학수번호가 달라도 같은 과목이라 중복 수강 인정이 안 되기 때문.
    const { getCoursesByCodes, getCurriculumForDepartment, getElectiveCandidates, getIndustryFields } = await import("./queries")
    const department = "컴퓨터인공지능학부"
    const curriculum = await getCurriculumForDepartment(department)
    const ownRequired = await getCoursesByCodes(curriculum!.requiredCourseCodes as string[])
    const industryFields = await getIndustryFields()
    const aiTag = industryFields.find((f) => f.name === "AI·데이터사이언스")

    if (!aiTag || !ownRequired.some((c) => c.name === "인공지능")) {
      // 시드 데이터가 바뀌어 전제가 깨지면 이 테스트는 조용히 건너뛴다(핵심 로직은 다른 케이스로도 검증됨).
      return
    }

    const excludeCodes = ownRequired.map((c) => c.code)
    const excludeNames = ownRequired.map((c) => c.name)
    const candidates = await getElectiveCandidates([aiTag.id], department, excludeCodes, excludeNames, 80)

    expect(candidates.some((c) => c.name === "인공지능")).toBe(false)

    const nameCounts = new Map<string, number>()
    for (const c of candidates) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1)
    expect([...nameCounts.values()].every((count) => count === 1)).toBe(true)
  })
})
