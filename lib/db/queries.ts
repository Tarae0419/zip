import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm"
import { unstable_cache } from "next/cache"

import type { Course, HashtagStat, Review } from "@/lib/types"
import { db } from "./client"
import {
  courseDepartmentTracks,
  courseFieldTags,
  courseIndustryTags,
  courses,
  curricula,
  fieldTags,
  industryTags,
  reviews,
  summaries,
  users,
} from "./schema"

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
    semester: row.semester,
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

/** 홈 히어로 통계 배지용 — 실제 DB 값만 쓴다(리뷰 수는 아직 데모 수준이라 과장된 인상을 줄 수 있어 배지에서 뺐다). */
export async function getCourseStats(): Promise<{ courseCount: number; departmentCount: number }> {
  const courseResult = await db.execute(sql`select count(distinct coalesce(code, name)) as count from courses`)
  const departmentResult = await db.execute(sql`select count(distinct department) as count from courses`)
  return {
    courseCount: Number((courseResult.rows[0] as { count: string }).count),
    departmentCount: Number((departmentResult.rows[0] as { count: string }).count),
  }
}

const POPULAR_RECENT_DAYS = 30
const POPULAR_MIN_AVERAGE_RATING = 3.5

/**
 * 홈 "인기 과목" — 최근 POPULAR_RECENT_DAYS일 동안 리뷰가 늘어난 순(리뷰 "증가량")으로 뽑되,
 * 평점이 너무 낮은 과목이 리뷰 수만으로 상위에 뜨지 않도록 평균 평점 하한(POPULAR_MIN_AVERAGE_RATING)을 같이 건다.
 * 과목은 학수번호(code, 없으면 이름)가 같으면 학기가 달라도 같은 과목이므로(getSiblingCourseIds와 동일한 규칙),
 * 리뷰 집계도 그 기준으로 학기를 걸쳐 합산한다 — 안 그러면 학기마다 다른 courses row에 리뷰가 나뉘어 붙어
 * "인기 과목" 카드의 리뷰 수가 실제보다 적게(또는 새 리뷰가 안 늘어난 것처럼) 보일 수 있다.
 * 아직 최근 리뷰가 쌓인 과목이 limit개보다 적으면, 예전처럼 수강인원(enrolledCount) 순으로 남은 자리를 채운다
 * — 리뷰 데이터가 부족한 초기 상태에서도 섹션이 비어 보이지 않게 하기 위함.
 */
export async function getPopularCourses(limit = 6): Promise<Course[]> {
  const identityExpr = sql<string>`coalesce(${courses.code}, ${courses.name})`
  const recentCutoff = new Date(Date.now() - POPULAR_RECENT_DAYS * 24 * 60 * 60 * 1000)

  const statRows = await db
    .select({
      identity: identityExpr,
      totalReviews: sql<string>`count(*) filter (where ${reviews.isFiltered} = false)`,
      recentReviews: sql<string>`count(*) filter (where ${reviews.isFiltered} = false and ${reviews.createdAt} >= ${recentCutoff})`,
      avgRating: sql<string>`avg(${reviews.rating}) filter (where ${reviews.isFiltered} = false)`,
    })
    .from(courses)
    .innerJoin(reviews, eq(reviews.courseId, courses.id))
    .where(eq(courses.isPublic, true))
    .groupBy(identityExpr)

  const stats = statRows
    .map((r) => ({
      identity: r.identity,
      totalReviews: Number(r.totalReviews),
      recentReviews: Number(r.recentReviews),
      avgRating: Number(r.avgRating),
    }))
    .filter((s) => s.recentReviews > 0)
    // 평점 하한을 넘는 과목을 먼저, 그 안에서는 최근 리뷰 증가량 → 평균 평점 순.
    .sort((a, b) => {
      const aOk = a.avgRating >= POPULAR_MIN_AVERAGE_RATING ? 1 : 0
      const bOk = b.avgRating >= POPULAR_MIN_AVERAGE_RATING ? 1 : 0
      if (aOk !== bOk) return bOk - aOk
      return b.recentReviews - a.recentReviews || b.avgRating - a.avgRating
    })

  const rankedIdentities = stats.slice(0, limit).map((s) => s.identity)

  // 리뷰 기반 순위가 limit에 못 미치면, 리뷰가 아직 없거나 최근에 없는 과목을 수강인원 순으로 채운다.
  if (rankedIdentities.length < limit) {
    const fallbackRows = await db
      .select({ id: courses.id, identity: identityExpr })
      .from(courses)
      .where(eq(courses.isPublic, true))
      .orderBy(sql`${courses.enrolledCount} desc nulls last`)
      .limit(limit * 5) // 같은 과목의 여러 학기 row가 섞여 있을 수 있어 넉넉히 가져와 중복 제거한다.

    const already = new Set(rankedIdentities)
    for (const row of fallbackRows) {
      if (rankedIdentities.length >= limit) break
      if (already.has(row.identity)) continue
      already.add(row.identity)
      rankedIdentities.push(row.identity)
    }
  }

  if (rankedIdentities.length === 0) return []

  // 식별자별 "대표" row(가장 최근 학기)를 하나씩 가져온다 — getCanonicalCourseId와 동일한 규칙(최신 학기 우선).
  const canonicalRows = await db
    .selectDistinctOn([identityExpr], { row: courses, identity: identityExpr })
    .from(courses)
    .where(and(eq(courses.isPublic, true), sql`${identityExpr} in ${rankedIdentities}`))
    .orderBy(identityExpr, desc(courses.semester))

  const rowByIdentity = new Map(canonicalRows.map((r) => [r.identity, r.row]))
  const statByIdentity = new Map(stats.map((s) => [s.identity, s]))

  const orderedRows = rankedIdentities.map((identity) => rowByIdentity.get(identity)).filter((r): r is CourseRow => Boolean(r))

  return orderedRows.map((row) => {
    const identity = row.code ?? row.name
    const stat = statByIdentity.get(identity)
    return toCourseView(row, {
      rating: stat ? stat.avgRating : 0,
      reviewCount: stat ? stat.totalReviews : 0,
      hashtags: [],
    })
  })
}

/**
 * 같은 과목이 학기마다(2026-1, 2026-2, ...) 별도 row로 존재하므로(코드+분반+학기가 유니크 키),
 * 리뷰는 "학수번호(code)가 같은 모든 학기의 row"를 한데 모아 집계한다.
 * code가 없는 소수의 row(원본 결측)는 과목명으로 대체 매칭한다.
 * 리뷰 자체는 사용자가 실제로 보고 있던 정확한 course.id에 저장한다 — 집계할 때만 묶는다.
 */
export async function getSiblingCourseIds(row: Pick<CourseRow, "code" | "name">): Promise<string[]> {
  const rows = row.code
    ? await db.select({ id: courses.id }).from(courses).where(eq(courses.code, row.code))
    : await db.select({ id: courses.id }).from(courses).where(eq(courses.name, row.name))
  return rows.map((r) => r.id)
}

/**
 * 같은 학수번호를 가진 여러 학기 row 중, 리뷰 요약(summaries)을 걸어둘 "대표" row를 고른다.
 * 학기 문자열("2026-2" > "2026-1")이 큰, 즉 가장 최근 학기의 row를 사용한다.
 */
export async function getCanonicalCourseId(siblingIds: string[]): Promise<string | null> {
  if (siblingIds.length === 0) return null
  const rows = await db
    .select({ id: courses.id, semester: courses.semester })
    .from(courses)
    .where(inArray(courses.id, siblingIds))
    .orderBy(desc(courses.semester))
    .limit(1)
  return rows[0]?.id ?? null
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
  semester?: string
}

function buildFilterConditions(filters: SearchFilters) {
  const extra = []
  if (filters.credits) extra.push(eq(courses.credits, filters.credits))
  if (filters.requirementType) extra.push(eq(courses.requirementType, filters.requirementType as CourseRow["requirementType"]))
  if (filters.semester) extra.push(eq(courses.semester, filters.semester))
  return extra
}

/**
 * 검색 필터의 "학기" 드롭다운용 — 실제 DB에 존재하는 학기 목록(최신순)만 보여준다.
 * courses.semester 값은 재수강편람 재import 때만 바뀌므로(요청마다 달라지지 않음) 1시간 캐싱한다.
 * Neon HTTP 드라이버는 커넥션을 재사용하지 않아 쿼리 하나당 왕복이 100~250ms씩 붙는데,
 * 이 목록은 /cart·/search의 모든 필터 드롭다운을 바꿀 때마다 매번 새로 조회되고 있었다.
 */
export const getDistinctSemesters = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.selectDistinct({ semester: courses.semester }).from(courses)
    return rows.map((r) => r.semester).sort((a, b) => b.localeCompare(a))
  },
  ["distinct-semesters"],
  { revalidate: 3600 },
)

/**
 * "내 시간표" F5 — 학기 선택 후 그 학기에 실제로 개설된 과목만 불러와 담을 수 있게 한다.
 * 검색어 없이도 둘러볼 수 있어야 하므로(searchCoursesByName은 빈 query에서 아무것도 안 돌려준다),
 * 별도 조회 함수로 분리했다. 검색어/학과 필터는 선택 사항.
 * unstable_cache로 (semester, query, department, grade) 조합별 60초 캐싱 — 같은 필터 조합을
 * 여러 사용자가 반복 조회해도 Neon 왕복이 매번 발생하지 않게 한다.
 */
export const getCoursesForSemester = unstable_cache(
  async ({
    semester,
    query,
    department,
    grade,
    limit = 30,
  }: {
    semester: string
    query?: string
    department?: string
    grade?: number
    limit?: number
  }): Promise<Course[]> => {
    const conditions = [eq(courses.isPublic, true), eq(courses.semester, semester)]
    if (query) conditions.push(ilike(courses.name, `%${query}%`))
    if (department) conditions.push(eq(courses.department, department))

    let rows: CourseRow[]
    if (grade) {
      const joined = await db
        .selectDistinct({ course: courses })
        .from(courses)
        .innerJoin(courseDepartmentTracks, eq(courseDepartmentTracks.courseId, courses.id))
        .where(and(...conditions, eq(courseDepartmentTracks.grade, grade)))
        .orderBy(sql`${courses.enrolledCount} desc nulls last`, courses.name)
        .limit(limit)
      rows = joined.map((r) => r.course)
    } else {
      rows = await db
        .select()
        .from(courses)
        .where(and(...conditions))
        .orderBy(sql`${courses.enrolledCount} desc nulls last`, courses.name)
        .limit(limit)
    }

    // 이 목록만 "과목 추가" 카드에서 수업 시간을 미리 보여줘야 해서 timeSlots를 같이 붙인다
    // (toCourseView는 다른 화면과 공유하므로 여기서만 별도로 채운다).
    const timeSlotsById = new Map(rows.map((r) => [r.id, r.timeSlots]))
    const views = await attachReviewStats(rows)
    return views.map((c) => ({ ...c, timeSlots: timeSlotsById.get(c.id) ?? null }))
  },
  ["courses-for-semester"],
  { revalidate: 60 },
)

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
 * 태그명 자체뿐 아니라 동의어 사전(field_tags.synonyms, 예: "수학" ↔ "수리과학")도 함께 매칭한다 (PRD 8.2 요구사항 6).
 */
export async function searchCoursesByFieldTag(
  query: string,
  excludeCourseIds: string[],
  filters: SearchFilters,
): Promise<Course[]> {
  const synonymMatch = sql<boolean>`exists (
    select 1 from jsonb_array_elements_text(${fieldTags.synonyms}) as syn
    where syn ilike ${`%${query}%`}
  )`
  const conditions = [
    eq(courses.isPublic, true),
    or(ilike(fieldTags.name, `%${query}%`), synonymMatch),
    ...buildFilterConditions(filters),
  ]
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

export type IndustryFieldSummary = {
  id: string
  name: string
  description: string
  icon: string
  courseCount: number
}

/** F3 — 산업/진로 분야 목록 + 태깅된 과목 수 (분야 카드 그리드용) */
export async function getIndustryFields(): Promise<IndustryFieldSummary[]> {
  const rows = await db
    .select({
      id: industryTags.id,
      name: industryTags.name,
      description: industryTags.description,
      icon: industryTags.icon,
      courseCount: sql<number>`count(${courseIndustryTags.courseId})`,
    })
    .from(industryTags)
    .leftJoin(courseIndustryTags, eq(courseIndustryTags.industryTagId, industryTags.id))
    .groupBy(industryTags.id)
    .orderBy(industryTags.name)

  return rows.map((r) => ({ ...r, courseCount: Number(r.courseCount) }))
}

/** F3 — 특정 산업분야의 연관도 상위 과목 (PRD 8.3 요구사항 4 — 연관도 순 정렬) */
export async function getIndustryFieldCourses(industryTagId: string, limit = 12): Promise<Course[]> {
  const rows = await db
    .select({ course: courses })
    .from(courseIndustryTags)
    .innerJoin(courses, eq(courses.id, courseIndustryTags.courseId))
    .where(and(eq(courseIndustryTags.industryTagId, industryTagId), eq(courses.isPublic, true)))
    .orderBy(desc(courseIndustryTags.relevanceScore))
    .limit(limit)

  return attachReviewStats(rows.map((r) => r.course))
}

/** F3 요구사항 5 — 실제 개설학과 목록(학과 선택 드롭다운용) */
export const getDistinctDepartments = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.selectDistinct({ department: courses.department }).from(courses)
    return rows.map((r) => r.department).sort((a, b) => a.localeCompare(b, "ko"))
  },
  ["distinct-departments"],
  { revalidate: 3600 },
)

export async function getUserDepartment(anonId: string): Promise<string | null> {
  const [row] = await db.select({ department: users.department }).from(users).where(eq(users.anonId, anonId)).limit(1)
  return row?.department ?? null
}

// ── F4 — 커리큘럼 추천 ──────────────────────────────────────────────

export type CurriculumRow = typeof curricula.$inferSelect

/** F4는 curricula 데이터가 있는 학과에서만 의미 있게 동작한다 (Sprint 5 — 현재 더미 데이터 2개 학과뿐). */
export async function getCurriculumDepartments(): Promise<string[]> {
  const rows = await db.selectDistinct({ department: curricula.department }).from(curricula)
  return rows.map((r) => r.department).sort((a, b) => a.localeCompare(b, "ko"))
}

export async function getCurriculumForDepartment(department: string): Promise<CurriculumRow | null> {
  const rows = await db
    .select()
    .from(curricula)
    .where(eq(curricula.department, department))
    .orderBy(desc(curricula.admissionYear))
    .limit(1)
  return rows[0] ?? null
}

export type RequiredCourseInfo = {
  courseId: string
  code: string
  name: string
  credits: number
  department: string
  prerequisiteCodes: string[]
}

/** 학수번호 목록에 대해 (가장 최근 학기의) 대표 과목 정보를 반환한다. */
export async function getCoursesByCodes(codes: string[]): Promise<RequiredCourseInfo[]> {
  if (codes.length === 0) return []
  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      credits: courses.credits,
      department: courses.department,
      prerequisiteCodes: courses.prerequisiteCodes,
      semester: courses.semester,
    })
    .from(courses)
    .where(inArray(courses.code, codes))

  const byCode = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    if (!r.code) continue
    const existing = byCode.get(r.code)
    if (!existing || r.semester > existing.semester) byCode.set(r.code, r)
  }
  return [...byCode.values()].map((r) => ({
    courseId: r.id,
    code: r.code as string,
    name: r.name,
    credits: r.credits,
    department: r.department,
    prerequisiteCodes: (r.prerequisiteCodes as string[]) ?? [],
  }))
}

export type OwnMajorElectiveCandidate = {
  courseId: string
  code: string
  name: string
  credits: number
  relevanceScore: number // 관심분야와 매칭이 없으면 0 — 그래도 전공선택 요건을 채워야 하니 후보에는 포함한다
  matchedIndustryTagId: string | null
}

/**
 * PRD 8.4 추천로직 7~8 — "전공선택 학점 요건 중 남은 학점"을 채울 본인 학과 전공선택 과목 후보.
 * 관심분야와 연관도가 있으면 그 점수로 우선 정렬하되(요구사항 8), 연관도가 전혀 없어도
 * 전공선택 요건 자체는 채워야 하므로 후보에서 제외하지 않는다 — 그런 과목은 relevanceScore 0으로 뒤로 밀린다.
 */
export async function getOwnMajorElectiveCourses(
  department: string,
  interestFieldIds: string[],
  excludeCodes: string[],
  excludeNames: string[],
): Promise<OwnMajorElectiveCandidate[]> {
  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      credits: courses.credits,
      semester: courses.semester,
    })
    .from(courses)
    .where(and(eq(courses.department, department), eq(courses.requirementType, "전공선택"), eq(courses.isPublic, true)))

  const byCode = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    if (!r.code) continue
    const existing = byCode.get(r.code)
    if (!existing || r.semester > existing.semester) byCode.set(r.code, r)
  }

  const excludeCodeSet = new Set(excludeCodes)
  const excludeNameSet = new Set(excludeNames)
  const seenNames = new Set<string>()
  const filtered: (typeof rows)[number][] = []
  for (const r of byCode.values()) {
    if (!r.code || excludeCodeSet.has(r.code) || excludeNameSet.has(r.name) || seenNames.has(r.name)) continue
    seenNames.add(r.name)
    filtered.push(r)
  }

  if (filtered.length === 0) return []

  const relevanceByCourseId = new Map<string, { score: number; tagId: string }>()
  if (interestFieldIds.length > 0) {
    const relRows = await db
      .select({
        courseId: courseIndustryTags.courseId,
        relevanceScore: courseIndustryTags.relevanceScore,
        industryTagId: courseIndustryTags.industryTagId,
      })
      .from(courseIndustryTags)
      .where(
        and(
          inArray(
            courseIndustryTags.courseId,
            filtered.map((r) => r.id),
          ),
          inArray(courseIndustryTags.industryTagId, interestFieldIds),
        ),
      )
    for (const r of relRows) {
      const existing = relevanceByCourseId.get(r.courseId)
      if (!existing || r.relevanceScore > existing.score) {
        relevanceByCourseId.set(r.courseId, { score: r.relevanceScore, tagId: r.industryTagId })
      }
    }
  }

  const candidates: OwnMajorElectiveCandidate[] = filtered.map((r) => {
    const rel = relevanceByCourseId.get(r.id)
    return {
      courseId: r.id,
      code: r.code as string,
      name: r.name,
      credits: r.credits,
      relevanceScore: rel?.score ?? 0,
      matchedIndustryTagId: rel?.tagId ?? null,
    }
  })

  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore)
  return candidates
}

export type ElectiveCandidate = {
  courseId: string
  code: string
  name: string
  department: string
  credits: number
  relevanceScore: number
  industryTagId: string
  isOwnMajor: boolean
}

/**
 * F4 요구사항 8 — 관심분야 연관도가 높은 전공선택/자유선택 후보. 본인 전공을 우선 정렬한다
 * (본인 전공 내 과목을 우선하되 부족하면 타 전공도 추천).
 *
 * 타 전공 과목이라도 학수번호나 과목명이 같으면 사실상 같은 과목(중복 학점 인정 불가)이므로,
 * excludeNames로 이미 배치된 과목명을 넘기면 후보에서 제외하고, 후보 목록 자체도 과목명 기준으로
 * 한 번 더 중복 제거한다 — 같은 "인공지능"이 학과마다 다른 학수번호로 여러 번 추천되는 걸 막는다.
 */
export async function getElectiveCandidates(
  interestFieldIds: string[],
  department: string,
  excludeCodes: string[],
  excludeNames: string[],
  limit = 60,
): Promise<ElectiveCandidate[]> {
  if (interestFieldIds.length === 0) return []

  const rows = await db
    .select({
      courseId: courses.id,
      code: courses.code,
      name: courses.name,
      department: courses.department,
      credits: courses.credits,
      relevanceScore: courseIndustryTags.relevanceScore,
      industryTagId: courseIndustryTags.industryTagId,
    })
    .from(courseIndustryTags)
    .innerJoin(courses, eq(courses.id, courseIndustryTags.courseId))
    .where(and(inArray(courseIndustryTags.industryTagId, interestFieldIds), eq(courses.isPublic, true)))
    .orderBy(desc(courseIndustryTags.relevanceScore))

  const excludeCodeSet = new Set(excludeCodes)
  const excludeNameSet = new Set(excludeNames)
  const bestByCode = new Map<string, ElectiveCandidate>()
  for (const r of rows) {
    if (!r.code || excludeCodeSet.has(r.code) || excludeNameSet.has(r.name) || bestByCode.has(r.code)) continue
    bestByCode.set(r.code, {
      courseId: r.courseId,
      code: r.code,
      name: r.name,
      department: r.department,
      credits: r.credits,
      relevanceScore: r.relevanceScore,
      industryTagId: r.industryTagId,
      isOwnMajor: r.department === department,
    })
  }

  const sorted = [...bestByCode.values()].sort((a, b) => {
    if (a.isOwnMajor !== b.isOwnMajor) return a.isOwnMajor ? -1 : 1
    return b.relevanceScore - a.relevanceScore
  })

  // 과목명 기준 중복 제거 — 위 정렬 순서(본인 전공 우선, 그다음 연관도순) 그대로 첫 등장만 남긴다.
  const seenNames = new Set<string>()
  const deduped: ElectiveCandidate[] = []
  for (const c of sorted) {
    if (seenNames.has(c.name)) continue
    seenNames.add(c.name)
    deduped.push(c)
  }

  return deduped.slice(0, limit)
}
