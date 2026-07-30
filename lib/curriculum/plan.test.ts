import { describe, expect, it } from "vitest"
import { buildSemesters, fillElectives, fillMajorElectives, placeRequiredCourses, toSemesterLabels } from "./plan"
import type { RequiredCourseInfo, ElectiveCandidate, OwnMajorElectiveCandidate } from "@/lib/db/queries"

function course(overrides: Partial<RequiredCourseInfo> & Pick<RequiredCourseInfo, "code" | "name">): RequiredCourseInfo {
  return {
    courseId: `id-${overrides.code}`,
    credits: 3,
    department: "테스트학과",
    prerequisiteCodes: [],
    ...overrides,
  }
}

function candidate(overrides: Partial<ElectiveCandidate> & Pick<ElectiveCandidate, "code" | "name">): ElectiveCandidate {
  return {
    courseId: `id-${overrides.code}`,
    department: "테스트학과",
    credits: 3,
    relevanceScore: 0.5,
    industryTagId: "tag-1",
    isOwnMajor: true,
    ...overrides,
  }
}

function majorCandidate(
  overrides: Partial<OwnMajorElectiveCandidate> & Pick<OwnMajorElectiveCandidate, "code" | "name">,
): OwnMajorElectiveCandidate {
  return {
    courseId: `id-${overrides.code}`,
    credits: 3,
    relevanceScore: 0,
    matchedIndustryTagId: null,
    ...overrides,
  }
}

describe("placeRequiredCourses", () => {
  it("places courses with no prerequisites into the earliest semester with room", () => {
    const courses = [course({ code: "A", name: "A과목" }), course({ code: "B", name: "B과목" })]
    const { semesterItems, semesterCredits, requiredCreditsPlaced } = placeRequiredCourses(
      [{ courses, type: "전공필수" }],
      3,
    )
    expect(semesterItems[0].map((i) => i.courseCode)).toEqual(["A", "B"])
    expect(semesterCredits[0]).toBe(6)
    expect(requiredCreditsPlaced).toBe(6)
  })

  it("pushes a course to a later semester than its prerequisite when both are incomplete", () => {
    const courses = [
      course({ code: "ALGO", name: "알고리즘", prerequisiteCodes: ["DS"] }),
      course({ code: "DS", name: "자료구조" }),
    ]
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 4)

    const dsSemester = semesterItems.findIndex((items) => items.some((i) => i.courseCode === "DS"))
    const algoSemester = semesterItems.findIndex((items) => items.some((i) => i.courseCode === "ALGO"))
    expect(dsSemester).toBeGreaterThanOrEqual(0)
    expect(algoSemester).toBeGreaterThan(dsSemester)
  })

  it("does not apply an ordering constraint when the prerequisite is already completed (not in the incomplete set)", () => {
    // DS(자료구조)가 이수 완료 처리되어 courses 배열에 아예 없는 상황 — ALGO만 남는다.
    const courses = [course({ code: "ALGO", name: "알고리즘", prerequisiteCodes: ["DS"] })]
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 3)
    expect(semesterItems[0].map((i) => i.courseCode)).toEqual(["ALGO"])
  })

  it("moves to the next semester once the 18-credit cap would be exceeded", () => {
    const courses = [
      course({ code: "A", name: "A", credits: 9 }),
      course({ code: "B", name: "B", credits: 9 }),
      course({ code: "C", name: "C", credits: 9 }),
    ]
    const { semesterItems, semesterCredits } = placeRequiredCourses([{ courses, type: "전공필수" }], 2)
    expect(semesterCredits[0]).toBeLessThanOrEqual(18)
    expect(semesterItems[1].length).toBeGreaterThan(0)
  })

  it("tags a second group as 복수전공필수", () => {
    const own = [course({ code: "A", name: "A" })]
    const double = [course({ code: "B", name: "B", department: "부전공학과" })]
    const { semesterItems } = placeRequiredCourses(
      [
        { courses: own, type: "전공필수" },
        { courses: double, type: "복수전공필수" },
      ],
      2,
    )
    const flat = semesterItems.flat()
    expect(flat.find((i) => i.courseCode === "A")?.type).toBe("전공필수")
    expect(flat.find((i) => i.courseCode === "B")?.type).toBe("복수전공필수")
  })
})

describe("fillElectives", () => {
  it("fills each semester toward the 16-credit target using the given candidate order", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], []]
    const semesterCredits = [0, 0]
    const candidates = [
      candidate({ code: "E1", name: "선택1" }),
      candidate({ code: "E2", name: "선택2" }),
    ]
    fillElectives(semesterItems, semesterCredits, candidates, new Map(), 100)
    expect(semesterItems[0].map((i) => i.courseCode)).toContain("E1")
    expect(semesterItems[0][0].type).toBe("관심분야")
  })

  it("stops once the total credit budget is exhausted", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], [], []]
    const semesterCredits = [0, 0, 0]
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ code: `E${i}`, name: `선택${i}`, credits: 3 }))
    const { totalElectiveCreditsPlaced } = fillElectives(semesterItems, semesterCredits, candidates, new Map(), 7)
    expect(totalElectiveCreditsPlaced).toBeLessThanOrEqual(9) // 7학점 예산, 3학점 단위라 최대 1과목 초과 허용
    expect(totalElectiveCreditsPlaced).toBeGreaterThan(0)
  })

  it("adds an own-major disclaimer to the reason only when isOwnMajor is false", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [candidate({ code: "E1", name: "선택1", isOwnMajor: false, department: "타학과" })]
    const nameById = new Map([["tag-1", "반도체"]])
    fillElectives(semesterItems, semesterCredits, candidates, nameById, 20)
    expect(semesterItems[0][0].reason).toContain("반도체")
    expect(semesterItems[0][0].reason).toContain("타 전공")
  })

  it("does not place the same course code twice even if it appears in the candidate list twice", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [candidate({ code: "E1", name: "선택1" }), candidate({ code: "E1", name: "선택1" })]
    fillElectives(semesterItems, semesterCredits, candidates, new Map(), 20)
    expect(semesterItems[0].filter((i) => i.courseCode === "E1")).toHaveLength(1)
  })
})

describe("fillMajorElectives", () => {
  it("places 전공선택 courses up to the credit budget and tags them correctly", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [majorCandidate({ code: "M1", name: "전공선택1" }), majorCandidate({ code: "M2", name: "전공선택2" })]
    fillMajorElectives(semesterItems, semesterCredits, candidates, "테스트학과", new Map(), 3)
    expect(semesterItems[0]).toHaveLength(1)
    expect(semesterItems[0][0].type).toBe("전공선택")
    expect(semesterItems[0][0].isOwnMajor).toBe(true)
  })

  it("mentions the matched interest field in the reason only when relevanceScore came from a real match", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const nameById = new Map([["tag-1", "반도체"]])

    fillMajorElectives(
      semesterItems,
      semesterCredits,
      [majorCandidate({ code: "M1", name: "전공선택1", relevanceScore: 0.6, matchedIndustryTagId: "tag-1" })],
      "테스트학과",
      nameById,
      20,
    )
    expect(semesterItems[0][0].reason).toContain("반도체")

    const semesterItems2: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits2 = [0]
    fillMajorElectives(
      semesterItems2,
      semesterCredits2,
      [majorCandidate({ code: "M2", name: "전공선택2" })],
      "테스트학과",
      nameById,
      20,
    )
    expect(semesterItems2[0][0].reason).not.toContain("반도체")
    expect(semesterItems2[0][0].reason).toContain("전공선택 학점 요건")
  })
})

describe("toSemesterLabels / buildSemesters", () => {
  it("labels semesters sequentially and sums credits per semester", () => {
    const labels = toSemesterLabels(2, 2, 1)
    expect(labels).toEqual(["2학년 1학기", "2학년 2학기"])

    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [
      [
        { courseCode: "A", courseId: "id-A", name: "A", department: "d", credits: 3, type: "전공필수", reason: "", isOwnMajor: true },
      ],
      [],
    ]
    const semesters = buildSemesters(labels, semesterItems)
    expect(semesters[0].totalCredits).toBe(3)
    expect(semesters[1].totalCredits).toBe(0)
  })

  it("rolls over to the next grade after 2학기", () => {
    expect(toSemesterLabels(4, 2, 2)).toEqual(["2학년 2학기", "3학년 1학기", "3학년 2학기", "4학년 1학기"])
  })
})
