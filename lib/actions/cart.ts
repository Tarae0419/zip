"use server"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { cartItems, courses } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"
import type { CartCourse } from "@/lib/timetable/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toCartCourse(row: {
  id: string
  name: string
  department: string
  professor: string | null
  credits: number
  code: string | null
  semester: string
  classroom: string | null
  timeSlots: string | null
}): CartCourse {
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
  }
}

/** F5 "내 시간표" — 로그인 계정(anonId) 기준으로 담아둔 과목 전체를 불러온다. */
export async function getCartItems(): Promise<CartCourse[]> {
  const anonId = await getAnonId()
  const rows = await db
    .select({
      id: courses.id,
      name: courses.name,
      department: courses.department,
      professor: courses.professor,
      credits: courses.credits,
      code: courses.code,
      semester: courses.semester,
      classroom: courses.classroom,
      timeSlots: courses.timeSlots,
    })
    .from(cartItems)
    .innerJoin(courses, eq(courses.id, cartItems.courseId))
    .where(eq(cartItems.anonId, anonId))

  return rows.map(toCartCourse)
}

/** 이미 담겨 있으면 조용히 무시한다(onConflictDoNothing) — 토글 버튼이 중복 클릭에도 안전하게. */
export async function addCartItem(courseId: string): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(courseId)) return { ok: false }

  const anonId = await getAnonId()
  await ensureAnonUser(anonId)

  await db.insert(cartItems).values({ anonId, courseId }).onConflictDoNothing()
  return { ok: true }
}

/** 본인 계정의 항목만 지울 수 있다 — anonId도 조건에 넣어서 다른 계정 것을 지울 수 없게 한다. */
export async function removeCartItem(courseId: string): Promise<{ ok: boolean }> {
  const anonId = await getAnonId()
  await db.delete(cartItems).where(and(eq(cartItems.anonId, anonId), eq(cartItems.courseId, courseId)))
  return { ok: true }
}

/**
 * 장바구니(내 시간표)에 담을 때 필요한 최소 정보만 조회한다.
 * CourseCard/과목 상세 페이지는 목록/상세 렌더링용 Course(lib/types.ts)만 들고 있고
 * classroom·timeSlots는 없으므로, "담기" 클릭 시점에 이 액션으로 한 번 더 가져온다.
 */
export async function getCartCourseInfo(courseId: string): Promise<CartCourse | null> {
  if (!UUID_RE.test(courseId)) return null

  const [row] = await db
    .select({
      id: courses.id,
      name: courses.name,
      department: courses.department,
      professor: courses.professor,
      credits: courses.credits,
      code: courses.code,
      semester: courses.semester,
      classroom: courses.classroom,
      timeSlots: courses.timeSlots,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  return row ? toCartCourse(row) : null
}
