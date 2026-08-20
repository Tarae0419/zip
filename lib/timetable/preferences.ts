import { buildSessionsForCourse, estimateWalkMinutes } from "./schedule"
import { WEEKDAYS } from "./types"
import type { CartCourse, Weekday } from "./types"

export type TimePreference = "any" | "morning" | "afternoon"

export type SchedulePreferences = {
  timePreference: TimePreference
  preferredFreeDays: Weekday[]
  allowedStartMinutes?: number
  allowedEndMinutes?: number
  minCredits?: number
  maxCredits?: number
}

export type SchedulePreferenceEvaluation = {
  score: number
  matchedSessions: number
  totalSessions: number
  achievedFreeDays: Weekday[]
  missedFreeDays: Weekday[]
  notes: string[]
}

export type ScheduleCandidate = SchedulePreferenceEvaluation & {
  id: string
  courses: CartCourse[]
  estimatedWalkMinutes: number
  validationIssues: string[]
}

export type ScheduleValidationContext = {
  department?: string | null
  grade?: number | null
  completedCourseCodes?: string[]
}

const AFTERNOON_START_MINUTES = 12 * 60

export function evaluateSchedulePreferences(
  courses: CartCourse[],
  preferences: SchedulePreferences,
): SchedulePreferenceEvaluation {
  const sessions = courses.flatMap(buildSessionsForCourse)
  const scheduledDays = new Set(sessions.map((session) => session.day))
  const achievedFreeDays = preferences.preferredFreeDays.filter((day) => !scheduledDays.has(day))
  const missedFreeDays = preferences.preferredFreeDays.filter((day) => scheduledDays.has(day))

  const matchedSessions = sessions.filter((session) => {
    if (preferences.timePreference === "any") return true
    if (preferences.timePreference === "morning") return session.startMinutes < AFTERNOON_START_MINUTES
    return session.startMinutes >= AFTERNOON_START_MINUTES
  }).length

  const timeScore = sessions.length === 0 ? 100 : (matchedSessions / sessions.length) * 100
  const freeDayScore =
    preferences.preferredFreeDays.length === 0
      ? 100
      : (achievedFreeDays.length / preferences.preferredFreeDays.length) * 100
  const score = Math.round(timeScore * 0.6 + freeDayScore * 0.4)

  const notes: string[] = []
  const outsideAllowedTime = sessions.filter(
    (session) =>
      (preferences.allowedStartMinutes !== undefined && session.startMinutes < preferences.allowedStartMinutes) ||
      (preferences.allowedEndMinutes !== undefined && session.endMinutes > preferences.allowedEndMinutes),
  )
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0)
  if (sessions.length === 0) notes.push("시간 정보가 있는 과목이 없어 시간대 선호도를 계산하지 못했어요.")
  if (preferences.timePreference !== "any") {
    notes.push(`수업 ${sessions.length}개 중 ${matchedSessions}개가 선택한 시간대에 맞아요.`)
  }
  if (achievedFreeDays.length > 0) notes.push(`${achievedFreeDays.join("·")}요일 공강을 만족해요.`)
  if (missedFreeDays.length > 0) notes.push(`${missedFreeDays.join("·")}요일에는 현재 수업이 있어요.`)
  if (
    preferences.timePreference === "any" &&
    preferences.preferredFreeDays.length === 0 &&
    preferences.allowedStartMinutes === undefined &&
    preferences.allowedEndMinutes === undefined &&
    preferences.minCredits === undefined &&
    preferences.maxCredits === undefined
  ) {
    notes.push("시간대 또는 희망 공강을 선택하면 적합도를 계산할 수 있어요.")
  }
  if (outsideAllowedTime.length > 0) notes.push(`수업 가능 시간 밖에 있는 수업이 ${outsideAllowedTime.length}개 있어요.`)
  if (preferences.minCredits !== undefined && totalCredits < preferences.minCredits) {
    notes.push(`현재 ${totalCredits}학점으로 최소 ${preferences.minCredits}학점에 미달해요.`)
  }
  if (preferences.maxCredits !== undefined && totalCredits > preferences.maxCredits) {
    notes.push(`현재 ${totalCredits}학점으로 최대 ${preferences.maxCredits}학점을 초과해요.`)
  }

  return { score, matchedSessions, totalSessions: sessions.length, achievedFreeDays, missedFreeDays, notes }
}

export function satisfiesHardPreferences(courses: CartCourse[], preferences: SchedulePreferences): boolean {
  const sessions = courses.flatMap(buildSessionsForCourse)
  if (
    sessions.some(
      (session) =>
        (preferences.allowedStartMinutes !== undefined && session.startMinutes < preferences.allowedStartMinutes) ||
        (preferences.allowedEndMinutes !== undefined && session.endMinutes > preferences.allowedEndMinutes),
    )
  ) return false

  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0)
  if (preferences.minCredits !== undefined && totalCredits < preferences.minCredits) return false
  if (preferences.maxCredits !== undefined && totalCredits > preferences.maxCredits) return false
  return true
}

function hasConflict(candidate: CartCourse, selected: CartCourse[]): boolean {
  const candidateSessions = buildSessionsForCourse(candidate)
  const selectedSessions = selected.flatMap(buildSessionsForCourse)
  return candidateSessions.some((left) =>
    selectedSessions.some(
      (right) =>
        left.day === right.day &&
        left.startMinutes < right.endMinutes &&
        right.startMinutes < left.endMinutes,
    ),
  )
}

export function estimateScheduleWalkMinutes(courses: CartCourse[]): number {
  let total = 0
  for (const day of WEEKDAYS) {
    const sessions = courses
      .flatMap(buildSessionsForCourse)
      .filter((session) => session.day === day)
      .sort((a, b) => a.startMinutes - b.startMinutes)
    for (let index = 1; index < sessions.length; index++) {
      const previous = sessions[index - 1]
      const current = sessions[index]
      if (!previous.location || !current.location) continue
      if (previous.location.campus === current.location.campus && previous.location.building === current.location.building) continue
      total += estimateWalkMinutes(previous.location, current.location)
    }
  }
  return total
}

export function validateScheduleCourses(courses: CartCourse[], context: ScheduleValidationContext): string[] {
  const completed = new Set(context.completedCourseCodes ?? [])
  const selectedCodes = new Set(courses.flatMap((course) => (course.code ? [course.code] : [])))
  const issues = new Set<string>()

  for (const course of courses) {
    for (const prerequisite of course.prerequisiteCodes ?? []) {
      if (!completed.has(prerequisite)) {
        issues.add(
          selectedCodes.has(prerequisite)
            ? `${course.name}: 선수과목 ${prerequisite}을(를) 같은 학기에 담을 수 없어요.`
            : `${course.name}: 선수과목 ${prerequisite} 이수 여부를 확인하세요.`,
        )
      }
    }
    const target = course.targetStudents?.trim()
    if (target && context.grade && /\d학년/.test(target) && !target.includes(`${context.grade}학년`)) {
      issues.add(`${course.name}: 수강 대상(${target})과 현재 ${context.grade}학년 정보가 다를 수 있어요.`)
    }
  }

  return [...issues]
}

/** 과목별 분반 후보에서 충돌 없는 조합을 만들고 선호 점수가 높은 상위 결과를 반환한다. */
export function generateScheduleCandidates(
  optionGroups: CartCourse[][],
  preferences: SchedulePreferences,
  limit = 3,
  validationContext: ScheduleValidationContext = {},
): ScheduleCandidate[] {
  if (optionGroups.length === 0) return []

  const results: ScheduleCandidate[] = []
  const selected: CartCourse[] = []
  let explored = 0
  const MAX_COMBINATIONS = 20_000

  function visit(groupIndex: number) {
    if (explored >= MAX_COMBINATIONS) return
    if (groupIndex === optionGroups.length) {
      explored++
      if (!satisfiesHardPreferences(selected, preferences)) return
      const evaluation = evaluateSchedulePreferences(selected, preferences)
      results.push({
        ...evaluation,
        id: selected.map((course) => course.id).join("|"),
        courses: [...selected],
        estimatedWalkMinutes: estimateScheduleWalkMinutes(selected),
        validationIssues: validateScheduleCourses(selected, validationContext),
      })
      return
    }

    for (const option of optionGroups[groupIndex].slice(0, 8)) {
      if (hasConflict(option, selected)) continue
      selected.push(option)
      visit(groupIndex + 1)
      selected.pop()
    }
  }

  visit(0)
  return results
    .sort(
      (a, b) =>
        a.validationIssues.length - b.validationIssues.length ||
        b.score - a.score ||
        a.estimatedWalkMinutes - b.estimatedWalkMinutes ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(1, limit))
}
