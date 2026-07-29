// F4 결정론적 학점 계산·배치 로직 (PRD 8.4 추천로직 6~9). AI 위임 대상이 아니다 —
// 여기서 만든 계획에 관심분야 매칭 과목의 "추천 사유" 문장만 lib/ai/curriculum-reasons.ts가 다듬는다.
import type { ElectiveCandidate, RequiredCourseInfo } from "@/lib/db/queries"
import type { PlanItem, PlanItemType, PlanSemester } from "./types"

const TARGET_CREDITS_PER_SEMESTER = 16
const MAX_CREDITS_PER_SEMESTER = 18

type RequiredGroup = { courses: RequiredCourseInfo[]; type: Extract<PlanItemType, "전공필수" | "복수전공필수"> }

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
    const earliestAllowed = prereqSemesters.length > 0 ? Math.max(...prereqSemesters) + 1 : 0

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
): { usedCandidateCodes: Set<string>; totalElectiveCreditsPlaced: number } {
  const usedCandidateCodes = new Set<string>()
  let totalElectiveCreditsPlaced = 0
  let candidateIndex = 0

  for (let s = 0; s < semesterItems.length; s++) {
    while (
      candidateIndex < candidates.length &&
      semesterCredits[s] < TARGET_CREDITS_PER_SEMESTER &&
      totalElectiveCreditsPlaced < creditBudget
    ) {
      const candidate = candidates[candidateIndex]
      candidateIndex++
      if (usedCandidateCodes.has(candidate.code)) continue
      if (semesterCredits[s] + candidate.credits > MAX_CREDITS_PER_SEMESTER) continue

      const tagName = interestFieldNameById.get(candidate.industryTagId) ?? "관심"
      const majorNote = candidate.isOwnMajor ? "" : ` (${candidate.department} 개설 — 타 전공 수강 가능 여부는 별도 확인이 필요해요)`
      const reason = `${tagName} 분야 연관도가 높고 전공선택 학점으로 인정됩니다.${majorNote}`

      semesterItems[s].push({
        courseCode: candidate.code,
        courseId: candidate.courseId,
        name: candidate.name,
        department: candidate.department,
        credits: candidate.credits,
        type: "관심분야",
        reason,
        isOwnMajor: candidate.isOwnMajor,
        matchedIndustryTagId: candidate.industryTagId,
      })
      semesterCredits[s] += candidate.credits
      totalElectiveCreditsPlaced += candidate.credits
      usedCandidateCodes.add(candidate.code)
    }
  }

  return { usedCandidateCodes, totalElectiveCreditsPlaced }
}

export function toSemesterLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${i + 1}학기`)
}

export function buildSemesters(labels: string[], semesterItems: PlanItem[][]): PlanSemester[] {
  return labels.map((label, i) => ({
    label,
    totalCredits: semesterItems[i].reduce((sum, item) => sum + item.credits, 0),
    items: semesterItems[i],
  }))
}
