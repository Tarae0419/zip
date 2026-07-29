import { and, desc, eq, ilike, inArray, notInArray } from "drizzle-orm"

import type { Course, HashtagStat, Review } from "@/lib/types"
import { db } from "./client"
import { courseDepartmentTracks, courseFieldTags, courses, fieldTags, reviews, summaries } from "./schema"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CourseRow = typeof courses.$inferSelect

function toCourseView(
  row: CourseRow,
  stats: { rating: number; reviewCount: number; hashtags: HashtagStat[] },
  summary = "",
): Course {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    professor: row.professor ?? "미정",
    credits: row.credits,
    requirement: row.requirementType,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    hashtags: stats.hashtags,
    summary,
  }
}

/** 여러 과목의 리뷰 평점/개수를 한 번의 group-by 쿼리로 붙인다 (N+1 방지). 해시태그는 목록 화면에서는 계산하지 않는다. */
async function attachReviewStats(rows: CourseRow[]): Promise<Course[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const statRows = await db
    .select({ courseId: reviews.courseId, rating: reviews.rating })
    .from(reviews)
    .where(and(inArray(reviews.courseId, ids), eq(reviews.isFiltered, false)))

  const grouped = new Map<string, number[]>()
  for (const r of statRows) {
    const list = grouped.get(r.courseId) ?? []
    list.push(r.rating)
    grouped.set(r.courseId, list)
  }

  return rows.map((row) => {
    const ratings = grouped.get(row.id) ?? []
    const reviewCount = ratings.length
    const rating = reviewCount === 0 ? 0 : ratings.reduce((a, b) => a + b, 0) / reviewCount
    return toCourseView(row, { rating, reviewCount, hashtags: [] })
  })
}

/**
 * 홈 "인기 과목". 아직 리뷰 데이터가 없어 평점 기반 정렬은 무의미하므로,
 * 실제 수강편람에 있는 신호인 수강인원(enrolledCount) 순으로 정렬한다.
 */
export async function getPopularCourses(limit = 6): Promise<Course[]> {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.isPublic, true))
    .orderBy(desc(courses.enrolledCount))
    .limit(limit)

  return attachReviewStats(rows)
}

/**
 * 같은 과목이 학기마다(2026-1, 2026-2, ...) 별도 row로 존재하므로(코드+분반+학기가 유니크 키),
 * 리뷰는 "학수번호(code)가 같은 모든 학기의 row"를 한데 모아 집계한다.
 * code가 없는 소수의 row(원본 결측)는 과목명으로 대체 매칭한다.
 * 리뷰 자체는 사용자가 실제로 보고 있던 정확한 course.id에 저장한다 — 집계할 때만 묶는다.
 */
async function getSiblingCourseIds(row: CourseRow): Promise<string[]> {
  const rows = row.code
    ? await db.select({ id: courses.id }).from(courses).where(eq(courses.code, row.code))
    : await db.select({ id: courses.id }).from(courses).where(eq(courses.name, row.name))
  return rows.map((r) => r.id)
}

export async function getCourseView(id: string): Promise<{ course: Course; reviews: Review[] } | null> {
  if (!UUID_RE.test(id)) return null

  const [row] = await db.select().from(courses).where(eq(courses.id, id)).limit(1)
  if (!row) return null

  const siblingIds = await getSiblingCourseIds(row)

  const [reviewRows, summaryRow] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.isFiltered, false)))
      .orderBy(desc(reviews.createdAt)),
    db
      .select()
      .from(summaries)
      .where(inArray(summaries.courseId, siblingIds))
      .limit(1)
      .then((r) => r[0]),
  ])

  const reviewCount = reviewRows.length
  const rating = reviewCount === 0 ? 0 : reviewRows.reduce((s, r) => s + r.rating, 0) / reviewCount

  const tagCounts = new Map<string, number>()
  for (const r of reviewRows) {
    for (const tag of (r.hashtags as string[]) ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const hashtags: HashtagStat[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, percent: Math.round((count / reviewCount) * 100) }))
    .sort((a, b) => b.percent - a.percent)

  const course = toCourseView(row, { rating, reviewCount, hashtags }, summaryRow?.body ?? "")
  const reviewViews: Review[] = reviewRows.map((r) => ({
    id: r.id,
    rating: r.rating,
    semester: r.semester,
    body: r.body,
    hashtags: (r.hashtags as string[]) ?? [],
  }))

  return { course, reviews: reviewViews }
}

export type SearchFilters = {
  credits?: number
  grade?: number
  requirementType?: string
}

function buildFilterConditions(filters: SearchFilters) {
  const extra = []
  if (filters.credits) extra.push(eq(courses.credits, filters.credits))
  if (filters.requirementType) extra.push(eq(courses.requirementType, filters.requirementType as CourseRow["requirementType"]))
  return extra
}

/** F2 — "과목명 일치": 과목명에 검색어가 포함된 결과 */
export async function searchCoursesByName(query: string, filters: SearchFilters): Promise<{ rows: CourseRow[]; view: Course[] }> {
  const conditions = [eq(courses.isPublic, true), ilike(courses.name, `%${query}%`), ...buildFilterConditions(filters)]

  let rows: CourseRow[]
  if (filters.grade) {
    const joined = await db
      .selectDistinct({ course: courses })
      .from(courses)
      .innerJoin(courseDepartmentTracks, eq(courseDepartmentTracks.courseId, courses.id))
      .where(and(...conditions, eq(courseDepartmentTracks.grade, filters.grade)))
      .limit(60)
    rows = joined.map((r) => r.course)
  } else {
    rows = await db
      .select()
      .from(courses)
      .where(and(...conditions))
      .limit(60)
  }

  return { rows, view: await attachReviewStats(rows) }
}

/**
 * F2 — "분야 일치": 학문분야 태그(field_tags)와 매칭되는 과목.
 * field_tags/course_field_tags는 아직 AI 1차 분류 + 담당자 검수 전이라 비어 있어 항상 빈 배열을 반환하지만,
 * 태깅 데이터가 채워지는 즉시 이 쿼리만으로 동작한다.
 */
export async function searchCoursesByFieldTag(
  query: string,
  excludeCourseIds: string[],
  filters: SearchFilters,
): Promise<Course[]> {
  const conditions = [eq(courses.isPublic, true), ilike(fieldTags.name, `%${query}%`), ...buildFilterConditions(filters)]
  if (excludeCourseIds.length > 0) conditions.push(notInArray(courses.id, excludeCourseIds))

  const joined = await db
    .selectDistinct({ course: courses })
    .from(courses)
    .innerJoin(courseFieldTags, eq(courseFieldTags.courseId, courses.id))
    .innerJoin(fieldTags, eq(fieldTags.id, courseFieldTags.fieldTagId))
    .where(and(...conditions))
    .limit(60)

  return attachReviewStats(joined.map((r) => r.course))
}
