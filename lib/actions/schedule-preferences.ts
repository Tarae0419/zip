"use server"

import { and, eq, inArray, or } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { cartItems, courses, users } from "@/lib/db/schema"
import { getAnonId } from "@/lib/auth/anon-user"
import { getCartItems } from "@/lib/actions/cart"
import { generateScheduleCandidates } from "@/lib/timetable/preferences"
import type { ScheduleCandidate, SchedulePreferences } from "@/lib/timetable/preferences"
import type { CartCourse } from "@/lib/timetable/types"

const SEMESTER_RE = /^\d{4}-[12]$/

function toCartCourse(row: typeof courses.$inferSelect): CartCourse {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    professor: row.professor ?? "미정",
    credits: row.credits,
    code: row.code,
    semester: row.semester,
    classroom: row.classroom,
    timeSlots: row.timeSlots,
    targetStudents: row.targetStudents,
    prerequisiteCodes: (row.prerequisiteCodes as string[]) ?? [],
  }
}

export async function createPreferredScheduleCandidates(
  semester: string,
  preferences: SchedulePreferences,
): Promise<ScheduleCandidate[]> {
  if (!SEMESTER_RE.test(semester)) return []
  const safePreferences: SchedulePreferences = {
    timePreference: preferences.timePreference === "morning" || preferences.timePreference === "afternoon" ? preferences.timePreference : "any",
    preferredFreeDays: preferences.preferredFreeDays.filter((day) => ["월", "화", "수", "목", "금"].includes(day)),
    allowedStartMinutes: Math.max(9 * 60, Math.min(13 * 60, preferences.allowedStartMinutes ?? 9 * 60)),
    allowedEndMinutes: Math.max(15 * 60, Math.min(21 * 60, preferences.allowedEndMinutes ?? 21 * 60)),
    minCredits: Math.max(0, Math.min(30, preferences.minCredits ?? 0)),
    maxCredits: Math.max(1, Math.min(30, preferences.maxCredits ?? 30)),
  }
  if (safePreferences.allowedStartMinutes! >= safePreferences.allowedEndMinutes! || safePreferences.minCredits! > safePreferences.maxCredits!) return []
  const anonId = await getAnonId()
  const [currentItems, userRows] = await Promise.all([
    getCartItems(),
    db.select({ department: users.department, grade: users.grade, completedCourseIds: users.completedCourseIds })
      .from(users)
      .where(eq(users.anonId, anonId))
      .limit(1),
  ])
  const current = currentItems.filter((course) => course.semester === semester)
  if (current.length === 0) return []

  const codes = current.flatMap((course) => (course.code ? [course.code] : []))
  const namesWithoutCode = current.filter((course) => !course.code).map((course) => course.name)
  const identityCondition = or(
    codes.length > 0 ? inArray(courses.code, codes) : undefined,
    namesWithoutCode.length > 0 ? inArray(courses.name, namesWithoutCode) : undefined,
  )
  if (!identityCondition) return []

  const alternatives = await db
    .select()
    .from(courses)
    .where(and(eq(courses.semester, semester), eq(courses.isPublic, true), identityCondition))

  const byIdentity = new Map<string, CartCourse[]>()
  for (const row of alternatives) {
    const key = row.code ?? row.name
    const list = byIdentity.get(key) ?? []
    list.push(toCartCourse(row))
    byIdentity.set(key, list)
  }

  const optionGroups = current.map((course) => byIdentity.get(course.code ?? course.name) ?? [course])
  const user = userRows[0]
  return generateScheduleCandidates(optionGroups, safePreferences, 3, {
    department: user?.department,
    grade: user?.grade,
    completedCourseCodes: (user?.completedCourseIds as string[]) ?? [],
  })
}

export async function applyPreferredScheduleCandidate(semester: string, courseIds: string[]): Promise<{ ok: boolean }> {
  if (!SEMESTER_RE.test(semester) || courseIds.length === 0 || courseIds.length > 30) return { ok: false }
  const validRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.semester, semester), eq(courses.isPublic, true), inArray(courses.id, courseIds)))
  if (validRows.length !== new Set(courseIds).size) return { ok: false }

  const anonId = await getAnonId()
  const semesterRows = await db
    .select({ courseId: cartItems.courseId })
    .from(cartItems)
    .innerJoin(courses, eq(courses.id, cartItems.courseId))
    .where(and(eq(cartItems.anonId, anonId), eq(courses.semester, semester)))

  await db.transaction(async (tx) => {
    if (semesterRows.length > 0) {
      await tx.delete(cartItems).where(
        and(eq(cartItems.anonId, anonId), inArray(cartItems.courseId, semesterRows.map((row) => row.courseId))),
      )
    }
    await tx.insert(cartItems).values(courseIds.map((courseId) => ({ anonId, courseId }))).onConflictDoNothing()
  })
  return { ok: true }
}
