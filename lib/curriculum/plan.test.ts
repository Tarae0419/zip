import { describe, expect, it } from "vitest"
import { buildSemesters, computeSemesterGrades, fillElectives, fillMajorElectives, placeRequiredCourses, toSemesterLabels } from "./plan"
import type { RequiredCourseInfo, ElectiveCandidate, OwnMajorElectiveCandidate } from "@/lib/db/queries"

// 학년 제약이 핵심이 아닌 테스트에서는 넉넉한(항상 이수 가능한) 학기별 학년 배열을 쓴다.
function permissiveGrades(count: number): number[] {
  return Array(count).fill(4)
}

function course(overrides: Partial<RequiredCourseInfo> & Pick<RequiredCourseInfo, "code" | "name">): RequiredCourseInfo {
  return {
    courseId: `id-${overrides.code}`,
    credits: 3,
    department: "테스트학과",
    prerequisiteCodes: [],
    grade: null,
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
    grade: null,
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
    grade: null,
    ...overrides,
  }
}

describe("placeRequiredCourses", () => {
  it("places courses with no prerequisites into the earliest semester with room", () => {
    const courses = [course({ code: "A", name: "A과목" }), course({ code: "B", name: "B과목" })]
    const { semesterItems, semesterCredits, requiredCreditsPlaced } = placeRequiredCourses(
      [{ courses, type: "전공필수" }],
      3,
      permissiveGrades(3),
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
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 4, permissiveGrades(4))

    const dsSemester = semesterItems.findIndex((items) => items.some((i) => i.courseCode === "DS"))
    const algoSemester = semesterItems.findIndex((items) => items.some((i) => i.courseCode === "ALGO"))
    expect(dsSemester).toBeGreaterThanOrEqual(0)
    expect(algoSemester).toBeGreaterThan(dsSemester)
  })

  it("does not apply an ordering constraint when the prerequisite is already completed (not in the incomplete set)", () => {
    // DS(자료구조)가 이수 완료 처리되어 courses 배열에 아예 없는 상황 — ALGO만 남는다.
    const courses = [course({ code: "ALGO", name: "알고리즘", prerequisiteCodes: ["DS"] })]
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 3, permissiveGrades(3))
    expect(semesterItems[0].map((i) => i.courseCode)).toEqual(["ALGO"])
  })

  it("moves to the next semester once the 18-credit cap would be exceeded", () => {
    const courses = [
      course({ code: "A", name: "A", credits: 9 }),
      course({ code: "B", name: "B", credits: 9 }),
      course({ code: "C", name: "C", credits: 9 }),
    ]
    const { semesterItems, semesterCredits } = placeRequiredCourses([{ courses, type: "전공필수" }], 2, permissiveGrades(2))
    expect(semesterCredits[0]).toBeLessThanOrEqual(18)
    expect(semesterItems[1].length).toBeGreaterThan(0)
  })

  it("allows a course one grade above the student's current grade right away (lookahead)", () => {
    const courses = [course({ code: "NEXTUP", name: "한학년위과목", grade: 3 })]
    const grades = computeSemesterGrades(2, 2, 1) // 2학년 내내 → [2, 2]
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 2, grades)
    expect(semesterItems[0].map((i) => i.courseCode)).toContain("NEXTUP")
  })

  it("does not place a required course tagged two grades above the student's current grade", () => {
    const courses = [course({ code: "SENIOR", name: "고학년필수", grade: 4 })]
    const grades = computeSemesterGrades(2, 2, 1) // 2학년 내내 → [2, 2], lookahead(1)로도 4학년엔 못 미침
    const { semesterItems } = placeRequiredCourses([{ courses, type: "전공필수" }], 2, grades)
    expect(semesterItems[0]).toHaveLength(0)
    expect(semesterItems[1].map((i) => i.courseCode)).toContain("SENIOR") // 그래도 마지막 학기엔 배치됨
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
      permissiveGrades(2),
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
    fillElectives(semesterItems, semesterCredits, candidates, new Map(), 100, permissiveGrades(2))
    expect(semesterItems[0].map((i) => i.courseCode)).toContain("E1")
    expect(semesterItems[0][0].type).toBe("관심분야")
  })

  it("stops once the total credit budget is exhausted", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], [], []]
    const semesterCredits = [0, 0, 0]
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ code: `E${i}`, name: `선택${i}`, credits: 3 }))
    const { totalElectiveCreditsPlaced } = fillElectives(semesterItems, semesterCredits, candidates, new Map(), 7, permissiveGrades(3))
    expect(totalElectiveCreditsPlaced).toBeLessThanOrEqual(9) // 7학점 예산, 3학점 단위라 최대 1과목 초과 허용
    expect(totalElectiveCreditsPlaced).toBeGreaterThan(0)
  })

  it("prefers a course that exactly fits the semester's grade over a higher-relevance lookahead-only course", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], []]
    const semesterCredits = [0, 0]
    // ADV는 연관도가 더 높아 후보 목록에서 앞이지만, 2학년 학기엔 선이수(lookahead)로만 들어간다.
    // BASIC은 연관도는 낮아도 그 학기 학년에 그대로 맞는다 — 예산이 하나만 허용하면 BASIC이 먼저 채워져야 한다.
    const candidates = [
      candidate({ code: "ADV", name: "고학년관심과목", grade: 3, relevanceScore: 0.9 }),
      candidate({ code: "BASIC", name: "저학년관심과목", grade: 2, relevanceScore: 0.1 }),
    ]
    fillElectives(semesterItems, semesterCredits, candidates, new Map(), 3, [2, 2])
    expect(semesterItems[0].map((i) => i.courseCode)).toEqual(["BASIC"])
  })

  it("adds an own-major disclaimer to the reason only when isOwnMajor is false", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [candidate({ code: "E1", name: "선택1", isOwnMajor: false, department: "타학과" })]
    const nameById = new Map([["tag-1", "반도체"]])
    fillElectives(semesterItems, semesterCredits, candidates, nameById, 20, permissiveGrades(1))
    expect(semesterItems[0][0].reason).toContain("반도체")
    expect(semesterItems[0][0].reason).toContain("타 전공")
  })

  it("does not place the same course code twice even if it appears in the candidate list twice", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [candidate({ code: "E1", name: "선택1" }), candidate({ code: "E1", name: "선택1" })]
    fillElectives(semesterItems, semesterCredits, candidates, new Map(), 20, permissiveGrades(1))
    expect(semesterItems[0].filter((i) => i.courseCode === "E1")).toHaveLength(1)
  })
})

describe("fillMajorElectives", () => {
  it("places 전공선택 courses up to the credit budget and tags them correctly", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[]]
    const semesterCredits = [0]
    const candidates = [majorCandidate({ code: "M1", name: "전공선택1" }), majorCandidate({ code: "M2", name: "전공선택2" })]
    fillMajorElectives(semesterItems, semesterCredits, candidates, "테스트학과", new Map(), 3, permissiveGrades(1))
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
      permissiveGrades(1),
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
      permissiveGrades(1),
    )
    expect(semesterItems2[0][0].reason).not.toContain("반도체")
    expect(semesterItems2[0][0].reason).toContain("전공선택 학점 요건")
  })

  it("does not place a course two grades above the student's current grade into an early semester", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], []]
    const semesterCredits = [0, 0]
    const grades = computeSemesterGrades(2, 2, 1) // 2학년 내내 → [2, 2]
    const candidates = [majorCandidate({ code: "SENIOR", name: "고학년과목", grade: 4 })]
    fillMajorElectives(semesterItems, semesterCredits, candidates, "테스트학과", new Map(), 20, grades)
    expect(semesterItems[0].find((i) => i.courseCode === "SENIOR")).toBeUndefined()
  })

  it("allows a course one grade above the student's current grade right away (lookahead)", () => {
    const semesterItems: ReturnType<typeof placeRequiredCourses>["semesterItems"] = [[], []]
    const semesterCredits = [0, 0]
    const grades = computeSemesterGrades(2, 2, 1) // 2학년 내내 → [2, 2]
    const candidates = [majorCandidate({ code: "NEXTUP", name: "한학년위과목", grade: 3 })]
    fillMajorElectives(semesterItems, semesterCredits, candidates, "테스트학과", new Map(), 20, grades)
    expect(semesterItems[0].find((i) => i.courseCode === "NEXTUP")).toBeDefined()
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
