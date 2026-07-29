"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { courses } from "@/lib/db/schema"
import type { CartCourse } from "@/lib/timetable/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  if (!row) return null

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
