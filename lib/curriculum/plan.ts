// F4 결정론적 학점 계산·배치 로직 (PRD 8.4 추천로직 6~9).
// 2026-07-31부터: 전공필수 배치를 포함한 전체 커리큘럼 설계는 1차로 AI(lib/ai/curriculum-planner.ts)가 맡고,
// 이 파일의 함수들은 (a) lib/curriculum/reconcile-ai-plan.ts가 AI 결과의 졸업요건 완결성·선수과목 순서·
// 학점상한 위반을 검증·보정할 때 재사용하는 결정론적 안전망, (b) AI 호출 자체가 실패했을 때의 전체 폴백
// 경로로 쓰인다. 순위/배치 로직 자체는 바뀌지 않았다 — docs/SPRINT_PLAN.md 오픈 이슈 로그 2026-07-31 참고.
import type { ElectiveCandidate, OwnMajorElectiveCandidate, RequiredCourseInfo } from "@/lib/db/queries"
import type { PlanItem, PlanItemType, PlanSemester } from "./types"

// lib/curriculum/reconcile-ai-plan.ts도 같은 상수/판정 기준을 써야 해서 export한다(로직은 그대로).
export const TARGET_CREDITS_PER_SEMESTER = 16
export const MAX_CREDITS_PER_SEMESTER = 18
// 한 학년 위 과목까지는 미리 들을 수 있게 허용한다 — 완전히 못 박으면 3학년 2학기에 딱 한 학기
// 차이인 4학년 1학기 과목조차 못 들어가는 등 너무 빡빡했다.
const GRADE_LOOKAHEAD = 1

/** 현재 학년·학기를 시작점으로, 계획에 들어가는 각 학기가 몇 학년에 해당하는지 순서대로 계산한다. */
export function computeSemesterGrades(count: number, startGrade: number, startSemester: 1 | 2): number[] {
  return Array.from({ length: count }, (_, i) => startGrade + Math.floor((startSemester - 1 + i) / 2))
}

/** 학생 학년(+GRADE_LOOKAHEAD 선이수 허용)으로 과목의 권장 학년을 감당할 수 있는지. 학년 정보가 없으면 항상 가능. */
export function isGradeEligible(studentGrade: number, courseGrade: number | null): boolean {
  return courseGrade === null || courseGrade <= studentGrade + GRADE_LOOKAHEAD
}

/** 과목의 최소 권장 학년(course_department_tracks 기준)을 만족하는 가장 이른 학기 인덱스. 학년 정보가 없으면 제약 없음(0). */
export function earliestGradeEligibleIndex(semesterGrades: number[], grade: number | null): number {
  if (grade === null) return 0
  const idx = semesterGrades.findIndex((g) => isGradeEligible(g, grade))
  // 남은 학기 안에 그 학년(-1)에 도달하지 못하면(예: 4학기만 남았는데 4학년 과목) 그래도 마지막 학기에는 배치 가능하게 한다.
  return idx === -1 ? semesterGrades.length - 1 : idx
}

export type RequiredGroup = { courses: RequiredCourseInfo[]; type: Extract<PlanItemType, "전공필수" | "복수전공필수"> }

function toPlanItem(course: RequiredCourseInfo, type: PlanItemType, reason: string, isOwnMajor: boolean): PlanItem {
  return {
    courseCode: course.code,
    courseId: course.courseId,
    name: course.name,
    department: course.department,
    credits: course.credits,
    type,
    reason,
    isOwnMajor,
    prerequisiteCodes: course.prerequisiteCodes,
  }
}

function buildRequiredReason(course: RequiredCourseInfo, type: PlanItemType, overflow: boolean): string {
  const base = type === "복수전공필수" ? "복수전공 필수 과목으로 아직 이수하지 않았습니다." : "전공필수 과목으로 아직 이수하지 않았습니다."
  if (course.prerequisiteCodes.length > 0) {
    return `${base} 선수과목(${course.prerequisiteCodes.join(", ")}) 이수 순서를 고려해 배치했습니다.`
  }
  return overflow ? `${base} 잔여 학기 내 배치가 빠듯해 마지막 학기에 배치했습니다.` : base
}

/**
 * 미이수 전공필수(+복수전공필수) 과목을 선수과목 순서를 고려해 학기별로 배치한다 (PRD 8.4 추천로직 6).
 * 선수과목은 "이 배치 대상 안에 있는" 코드만 순서 제약으로 본다 — 이미 이수했거나 이수구분이 다른 과목은 제약에서 뺀다.
 */
export function placeRequiredCourses(
  groups: RequiredGroup[],
  remainingSemesters: number,
  semesterGrades: number[],
): { semesterItems: PlanItem[][]; semesterCredits: number[]; requiredCreditsPlaced: number } {
  const semesterItems: PlanItem[][] = Array.from({ length: remainingSemesters }, () => [])
  const semesterCredits: number[] = Array(remainingSemesters).fill(0)

  const flat = groups.flatMap((g) => g.courses.map((c) => ({ course: c, type: g.type })))
  const codeSet = new Set(flat.map((f) => f.course.code))

  // 선수과목 제약을 만족하는 것부터 순서대로 처리 (간단한 위상 정렬 — 순환이 있으면 그냥 원래 순서로 처리)
  const ordered: typeof flat = []
  const pool = [...flat]
  let guard = 0
  while (pool.length > 0 && guard < 1000) {
    guard++
    const idx = pool.findIndex((f) =>
      f.course.prerequisiteCodes.every((p) => !codeSet.has(p) || ordered.some((o) => o.course.code === p)),
    )
    const pick = idx === -1 ? 0 : idx
    ordered.push(pool[pick])
    pool.splice(pick, 1)
  }

  const placedSemesterByCode = new Map<string, number>()
  let requiredCreditsPlaced = 0

  for (const { course, type } of ordered) {
    const prereqSemesters = course.prerequisiteCodes
      .map((p) => placedSemesterByCode.get(p))
      .filter((s): s is number => s !== undefined)
    const earliestAllowed = Math.max(
      prereqSemesters.length > 0 ? Math.max(...prereqSemesters) + 1 : 0,
      earliestGradeEligibleIndex(semesterGrades, course.grade),
    )

    let target = -1
    for (let s = Math.min(earliestAllowed, remainingSemesters - 1); s < remainingSemesters; s++) {
      if (semesterCredits[s] + course.credits <= MAX_CREDITS_PER_SEMESTER) {
        target = s
        break
      }
    }
    // 어디에도 못 들어가면 마지막 학기에 강제 배치 (학점이 넘치더라도 빠뜨리지 않는다 — 미이수 필수과목이니까)
    if (target === -1) target = remainingSemesters - 1

    semesterCredits[target] += course.credits
    placedSemesterByCode.set(course.code, target)
    requiredCreditsPlaced += course.credits
    semesterItems[target].push(toPlanItem(course, type, buildRequiredReason(course, type, target === remainingSemesters - 1 && earliestAllowed >= remainingSemesters), true))
  }

  return { semesterItems, semesterCredits, requiredCreditsPlaced }
}

/**
 * PRD 8.4 추천로직 7~8 — "전공선택 학점 요건 중 남은 학점"을 본인 학과 전공선택 과목으로 채운다.
 * 관심분야와 연관도가 있으면 그 근거를 사유에 적고, 없어도 전공선택 요건 자체를 채우기 위해 배치한다
 * (getOwnMajorElectiveCourses가 연관도 0인 과목도 후보에 포함해서 넘겨준다).
 */
export function fillMajorElectives(
  semesterItems: PlanItem[][],
  semesterCredits: number[],
  candidates: OwnMajorElectiveCandidate[],
  department: string,
  interestFieldNameById: Map<string, string>,
  creditBudget: number,
  semesterGrades: number[],
): { usedCourseCodes: Set<string>; totalCreditsPlaced: number } {
  const usedCourseCodes = new Set<string>()
  let totalCreditsPlaced = 0

  function tryPlace(s: number, candidate: OwnMajorElectiveCandidate): boolean {
    if (usedCourseCodes.has(candidate.code)) return false
    if (semesterCredits[s] + candidate.credits > MAX_CREDITS_PER_SEMESTER) return false

    const tagName = candidate.matchedIndustryTagId ? interestFieldNameById.get(candidate.matchedIndustryTagId) : null
    const reason = tagName
      ? `전공선택 학점 요건을 채우면서, 과목명 기준으로 ${tagName} 분야와 연관도가 높게 나타난 과목이에요.`
      : "전공선택 학점 요건을 채우기 위한 과목이에요."

    semesterItems[s].push({
      courseCode: candidate.code,
      courseId: candidate.courseId,
      name: candidate.name,
      department,
      credits: candidate.credits,
      type: "전공선택",
      reason,
      isOwnMajor: true,
      prerequisiteCodes: [],
      matchedIndustryTagId: candidate.matchedIndustryTagId ?? undefined,
    })
    semesterCredits[s] += candidate.credits
    totalCreditsPlaced += candidate.credits
    usedCourseCodes.add(candidate.code)
    return true
  }

  for (let s = 0; s < semesterItems.length; s++) {
    // 먼저 그 학기 학년에 원래 맞는 과목부터 채우고(선이수 없이도 되는 것 우선), 자리가 남으면
    // 그다음에야 한 학년 선이수(lookahead) 과목을 본다 — 안 그러면 연관도 높은 고학년 과목이
    // 먼저 자리를 차지해서 저학년 과목들이 뒤로 밀려 마지막 학기에 몰리는 문제가 있었다.
    for (const candidate of candidates) {
      if (semesterCredits[s] >= TARGET_CREDITS_PER_SEMESTER || totalCreditsPlaced >= creditBudget) break
      if (candidate.grade !== null && candidate.grade > semesterGrades[s]) continue
      tryPlace(s, candidate)
    }
    for (const candidate of candidates) {
      if (semesterCredits[s] >= TARGET_CREDITS_PER_SEMESTER || totalCreditsPlaced >= creditBudget) break
      if (!isGradeEligible(semesterGrades[s], candidate.grade)) continue
      tryPlace(s, candidate)
    }
  }

  return { usedCourseCodes, totalCreditsPlaced }
}

/**
 * 전공선택/자유선택 잔여 학점을 관심분야 연관도 높은 과목으로 채운다 (PRD 8.4 추천로직 8~9).
 * 후보(candidates)는 이미 본인 전공 우선 + 연관도순으로 정렬돼 들어온다(getElectiveCandidates).
 * 사유(reason)는 여기서는 결정론적 템플릿만 채운다 — AI 문구는 lib/ai/curriculum-reasons.ts가 덧씌운다.
 */
export function fillElectives(
  semesterItems: PlanItem[][],
  semesterCredits: number[],
  candidates: ElectiveCandidate[],
  interestFieldNameById: Map<string, string>,
  creditBudget: number,
  semesterGrades: number[],
): { usedCandidateCodes: Set<string>; totalElectiveCreditsPlaced: number } {
  const usedCandidateCodes = new Set<string>()
  let totalElectiveCreditsPlaced = 0

  function tryPlace(s: number, candidate: ElectiveCandidate): boolean {
    if (usedCandidateCodes.has(candidate.code)) return false
    if (semesterCredits[s] + candidate.credits > MAX_CREDITS_PER_SEMESTER) return false

    const tagName = interestFieldNameById.get(candidate.industryTagId) ?? "관심"
    // "전공선택 학점으로 인정됩니다"는 이수구분이 실제로 전공선택이고 본인 학과일 때만 참이다 — 예전엔
    // 이 함수가 채우는 모든 관심분야 후보(교양·타 전공 포함)에 무조건 이 문구를 붙여서, 교양·타 전공
    // 과목도 전공선택 학점으로 인정되는 것처럼 잘못 안내하고 있었다(2026-08-01 사용자 신고로 발견).
    const creditNote =
      candidate.requirementType === "전공선택" && candidate.isOwnMajor
        ? " 전공선택 학점으로 인정돼요."
        : candidate.requirementType === "교양"
          ? " 교양 학점으로 활용할 수 있어요."
          : ""
    const typeLabel = candidate.requirementType ? ` ${candidate.requirementType}` : ""
    const majorNote = candidate.isOwnMajor
      ? ""
      : ` (${candidate.department} 개설${typeLabel} 과목 — 타 전공 수강 가능 여부는 별도 확인이 필요해요)`
    const reason = `${tagName} 분야 연관도가 높아요.${creditNote}${majorNote}`

    semesterItems[s].push({
      courseCode: candidate.code,
      courseId: candidate.courseId,
      name: candidate.name,
      department: candidate.department,
      credits: candidate.credits,
      type: "관심분야",
      reason,
      isOwnMajor: candidate.isOwnMajor,
      prerequisiteCodes: [],
      matchedIndustryTagId: candidate.industryTagId,
    })
    semesterCredits[s] += candidate.credits
    totalElectiveCreditsPlaced += candidate.credits
    usedCandidateCodes.add(candidate.code)
    return true
  }

  for (let s = 0; s < semesterItems.length; s++) {
    // fillMajorElectives와 같은 이유로 2패스 — 이 학기 학년에 그대로 맞는 관심분야 과목부터 채우고,
    // 자리가 남을 때만 한 학년 선이수(lookahead) 과목으로 채운다. 그래야 관심분야 추천도 전체 학기에
    // 고르게 퍼지고, 뒷 학기에만 몰리지 않는다.
    for (const candidate of candidates) {
      if (semesterCredits[s] >= TARGET_CREDITS_PER_SEMESTER || totalElectiveCreditsPlaced >= creditBudget) break
      if (candidate.grade !== null && candidate.grade > semesterGrades[s]) continue
      tryPlace(s, candidate)
    }
    for (const candidate of candidates) {
      if (semesterCredits[s] >= TARGET_CREDITS_PER_SEMESTER || totalElectiveCreditsPlaced >= creditBudget) break
      if (!isGradeEligible(semesterGrades[s], candidate.grade)) continue
      tryPlace(s, candidate)
    }
  }

  return { usedCandidateCodes, totalElectiveCreditsPlaced }
}

/** 현재 학년·학기를 시작점으로 "N학년 M학기" 라벨을 순서대로 생성한다 (예: 2학년 2학기 → 3학년 1학기 → 3학년 2학기). */
export function toSemesterLabels(count: number, startGrade: number, startSemester: 1 | 2): string[] {
  const grades = computeSemesterGrades(count, startGrade, startSemester)
  return grades.map((grade, i) => {
    const semesterIndex = startSemester - 1 + i
    const semester = (semesterIndex % 2) + 1
    return `${grade}학년 ${semester}학기`
  })
}

export function buildSemesters(labels: string[], semesterItems: PlanItem[][]): PlanSemester[] {
  return labels.map((label, i) => ({
    label,
    totalCredits: semesterItems[i].reduce((sum, item) => sum + item.credits, 0),
    items: semesterItems[i],
  }))
}
