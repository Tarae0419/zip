// lib/ai/curriculum-planner.ts가 고른 배치를 검증·보정한다 — AI 출력은 courseCode/semesterIndex/reason
// 3필드로 이미 후보 풀·범위 기준 1차 필터링을 거쳤지만, 여기서 보장하는 세 가지 불변식(필수과목 완결성·
// 선수과목 순서·학기당 18학점 상한)은 그와 별개로 이 함수가 결정론적으로 강제한다. AI가 이 세 가지를
// 지켰다면 이 함수는 사실상 통과만 시키고, 어겼다면 lib/curriculum/plan.ts의 기존 함수(placeRequiredCourses)를
// 재사용해 보정한다.
import type { AiCandidateCourse, AiPlacement } from "./ai-plan-types"
import { MAX_CREDITS_PER_SEMESTER, earliestGradeEligibleIndex, placeRequiredCourses } from "./plan"
import type { RequiredGroup } from "./plan"
import type { PlanItem, PlanItemType } from "./types"

function earliestSlotWithRoom(minIdx: number, credits: number, semesterCredits: number[], remainingSemesters: number): number {
  for (let s = Math.min(minIdx, remainingSemesters - 1); s < remainingSemesters; s++) {
    if (semesterCredits[s] + credits <= MAX_CREDITS_PER_SEMESTER) return s
  }
  return remainingSemesters - 1
}

function moveItem(
  semesterItems: PlanItem[][],
  semesterCredits: number[],
  placedSemesterByCode: Map<string, number>,
  code: string,
  fromIdx: number,
  toIdx: number,
) {
  if (fromIdx === toIdx) return
  const pos = semesterItems[fromIdx].findIndex((i) => i.courseCode === code)
  if (pos === -1) return
  const [item] = semesterItems[fromIdx].splice(pos, 1)
  semesterCredits[fromIdx] -= item.credits
  semesterItems[toIdx].push(item)
  semesterCredits[toIdx] += item.credits
  placedSemesterByCode.set(code, toIdx)
}

function minAllowedIndex(
  candidate: AiCandidateCourse,
  placedSemesterByCode: Map<string, number>,
  semesterGrades: number[],
): number {
  const prereqSemesters = candidate.prerequisiteCodes
    .map((p) => placedSemesterByCode.get(p))
    .filter((s): s is number => s !== undefined)
  return Math.max(
    prereqSemesters.length > 0 ? Math.max(...prereqSemesters) + 1 : 0,
    earliestGradeEligibleIndex(semesterGrades, candidate.grade),
  )
}

export function reconcileAiPlacements(params: {
  placements: AiPlacement[]
  requiredGroups: RequiredGroup[]
  candidatesByCode: Map<string, AiCandidateCourse>
  remainingSemesters: number
  semesterGrades: number[]
}): { semesterItems: PlanItem[][]; semesterCredits: number[]; requiredCreditsPlaced: number; repairNotes: string[] } {
  const { placements, requiredGroups, candidatesByCode, remainingSemesters, semesterGrades } = params
  const semesterItems: PlanItem[][] = Array.from({ length: remainingSemesters }, () => [])
  const semesterCredits: number[] = Array(remainingSemesters).fill(0)
  const placedSemesterByCode = new Map<string, number>()
  const repairNotes: string[] = []

  // 1. 스테이징 — type/name/credits 등 신뢰 필드는 항상 candidatesByCode에서 가져온다(모델 값 안 씀).
  for (const placement of placements) {
    const candidate = candidatesByCode.get(placement.courseCode)
    if (!candidate || placedSemesterByCode.has(placement.courseCode)) continue
    const idx = Math.min(Math.max(placement.semesterIndex, 0), remainingSemesters - 1)
    const item: PlanItem = {
      courseCode: candidate.courseCode,
      courseId: candidate.courseId,
      name: candidate.name,
      department: candidate.department,
      credits: candidate.credits,
      type: candidate.category,
      reason: placement.reason,
      isOwnMajor: candidate.isOwnMajor,
      prerequisiteCodes: candidate.prerequisiteCodes,
      matchedIndustryTagId: candidate.matchedIndustryTagId ?? undefined,
    }
    semesterItems[idx].push(item)
    semesterCredits[idx] += candidate.credits
    placedSemesterByCode.set(candidate.courseCode, idx)
  }

  // 2. AI가 빠뜨린 전공필수/복수전공필수를 기존 결정론적 배치 로직으로 강제 보완.
  const missingGroups = requiredGroups
    .map((g) => ({ ...g, courses: g.courses.filter((c) => !placedSemesterByCode.has(c.code)) }))
    .filter((g) => g.courses.length > 0)

  if (missingGroups.length > 0) {
    const forced = placeRequiredCourses(missingGroups, remainingSemesters, semesterGrades)
    const forcedItems = forced.semesterItems.flat()
    let missingCount = 0
    for (const item of forcedItems) {
      const candidate = candidatesByCode.get(item.courseCode)
      if (!candidate) continue
      const target = earliestSlotWithRoom(
        minAllowedIndex(candidate, placedSemesterByCode, semesterGrades),
        candidate.credits,
        semesterCredits,
        remainingSemesters,
      )
      semesterItems[target].push(item)
      semesterCredits[target] += candidate.credits
      placedSemesterByCode.set(candidate.courseCode, target)
      missingCount++
    }
    if (missingCount > 0) repairNotes.push(`AI가 놓친 전공필수 과목 ${missingCount}개를 자동으로 보완했어요.`)
  }

  // 3. 선수과목 순서·학년 제약 완화 루프 — 위반된 항목만 이후 학기로 이동(전진만, 유한 수렴).
  let changed = true
  let guard = 0
  while (changed && guard < 500) {
    changed = false
    guard++
    for (const [code, idx] of placedSemesterByCode) {
      const candidate = candidatesByCode.get(code)
      if (!candidate) continue
      const minAllowed = minAllowedIndex(candidate, placedSemesterByCode, semesterGrades)
      if (idx < minAllowed) {
        const target = earliestSlotWithRoom(minAllowed, candidate.credits, semesterCredits, remainingSemesters)
        if (target !== idx) {
          moveItem(semesterItems, semesterCredits, placedSemesterByCode, code, idx, target)
          changed = true
        }
      }
    }
  }

  // 4. 학기당 18학점 상한 정리 — 관심분야(연관도 낮은 순) → 전공선택(연관도 낮은 순) 순으로만 드롭.
  //    전공필수/복수전공필수는 절대 드롭하지 않는다(미이수 필수과목은 빠뜨리지 않는다는 기존 불변식과 동일).
  const dropRank = (t: PlanItemType) => (t === "관심분야" ? 0 : t === "전공선택" ? 1 : 2)
  for (let s = 0; s < remainingSemesters; s++) {
    if (semesterCredits[s] <= MAX_CREDITS_PER_SEMESTER) continue
    const droppable = semesterItems[s]
      .filter((i) => i.type === "관심분야" || i.type === "전공선택")
      .sort((a, b) => {
        const rankDiff = dropRank(a.type) - dropRank(b.type)
        if (rankDiff !== 0) return rankDiff
        const scoreA = candidatesByCode.get(a.courseCode)?.relevanceScore ?? 0
        const scoreB = candidatesByCode.get(b.courseCode)?.relevanceScore ?? 0
        return scoreA - scoreB
      })
    let dropped = 0
    for (const item of droppable) {
      if (semesterCredits[s] <= MAX_CREDITS_PER_SEMESTER) break
      const pos = semesterItems[s].findIndex((i) => i.courseCode === item.courseCode)
      if (pos === -1) continue
      semesterItems[s].splice(pos, 1)
      semesterCredits[s] -= item.credits
      placedSemesterByCode.delete(item.courseCode)
      dropped++
    }
    if (dropped > 0) repairNotes.push(`${s + 1}번째 학기 학점이 상한(18학점)을 넘어 선택과목 ${dropped}개를 제외했어요.`)
  }

  // 5. 집계
  let requiredCreditsPlaced = 0
  for (const items of semesterItems) {
    for (const item of items) {
      if (item.type === "전공필수" || item.type === "복수전공필수") requiredCreditsPlaced += item.credits
    }
  }

  return { semesterItems, semesterCredits, requiredCreditsPlaced, repairNotes }
}
