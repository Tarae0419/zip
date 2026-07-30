"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, ne, sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { courseFieldTags, courseIndustryTags, courses, fieldTags, industryTags, reviews, summaries } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth/admin"
import { getCanonicalCourseId, getSiblingCourseIds } from "@/lib/db/queries"
import { generateCourseSummary } from "@/lib/ai/summary"
import { openai } from "@/lib/ai/openai-client"

export type AdminActionResult = { ok: true } | { ok: false; error: string }

function revalidateCourse(courseId: string) {
  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath("/admin/courses")
  revalidatePath("/search")
  revalidatePath("/fields")
}

/** PRD 13.6 — 폐강·오류 데이터를 검색 결과에서 즉시 숨긴다. */
export async function adminSetCoursePublic(courseId: string, isPublic: boolean): Promise<AdminActionResult> {
  await requireAdmin()
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) return { ok: false, error: "과목을 찾을 수 없어요." }

  await db.update(courses).set({ isPublic }).where(eq(courses.id, courseId))
  revalidateCourse(courseId)
  return { ok: true }
}

/** PRD 13.5 — 과목의 선수과목(학수번호 목록)을 지정한다. */
export async function adminSetPrerequisites(courseId: string, codes: string[]): Promise<AdminActionResult> {
  await requireAdmin()
  const cleaned = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]

  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) return { ok: false, error: "과목을 찾을 수 없어요." }

  await db.update(courses).set({ prerequisiteCodes: cleaned }).where(eq(courses.id, courseId))
  revalidateCourse(courseId)
  return { ok: true }
}

/** PRD 13.4 — AI 요약 본문을 관리자가 직접 고쳐 쓴다. */
export async function adminUpdateSummary(courseId: string, body: string): Promise<AdminActionResult> {
  await requireAdmin()
  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: "요약 내용을 입력해주세요." }

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) return { ok: false, error: "과목을 찾을 수 없어요." }

  const siblingIds = await getSiblingCourseIds(course)
  const canonicalId = (await getCanonicalCourseId(siblingIds)) ?? courseId

  const [countRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(reviews)
    .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.isFiltered, false)))

  await db
    .insert(summaries)
    .values({ courseId: canonicalId, body: trimmed, basedReviewCount: Number(countRow.count) })
    .onConflictDoUpdate({ target: summaries.courseId, set: { body: trimmed, generatedAt: new Date() } })

  revalidateCourse(courseId)
  return { ok: true }
}

/** PRD 13.4 — 리뷰가 부족하거나 결과가 이상해도 관리자가 원할 때 강제로 AI 요약을 다시 생성한다. */
export async function adminRegenerateSummary(courseId: string): Promise<AdminActionResult> {
  await requireAdmin()

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) return { ok: false, error: "과목을 찾을 수 없어요." }

  const siblingIds = await getSiblingCourseIds(course)
  const validReviews = await db
    .select({ rating: reviews.rating, body: reviews.body, hashtags: reviews.hashtags })
    .from(reviews)
    .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.isFiltered, false)))

  if (validReviews.length === 0) {
    return { ok: false, error: "노출 중인 리뷰가 없어 요약을 생성할 수 없어요." }
  }

  const canonicalId = (await getCanonicalCourseId(siblingIds)) ?? courseId

  try {
    const summaryText = await generateCourseSummary(
      course.name,
      course.professor,
      validReviews.map((r) => ({ rating: r.rating, body: r.body, hashtags: (r.hashtags as string[]) ?? [] })),
    )
    if (!summaryText) return { ok: false, error: "AI 요약 생성에 실패했어요." }

    await db.delete(summaries).where(and(inArray(summaries.courseId, siblingIds), ne(summaries.courseId, canonicalId)))
    await db
      .insert(summaries)
      .values({ courseId: canonicalId, body: summaryText, basedReviewCount: validReviews.length })
      .onConflictDoUpdate({
        target: summaries.courseId,
        set: { body: summaryText, basedReviewCount: validReviews.length, generatedAt: new Date() },
      })
  } catch {
    return { ok: false, error: "AI 요약 생성 중 오류가 발생했어요." }
  }

  revalidateCourse(courseId)
  return { ok: true }
}

/** PRD 13.4 — 이름이 이미 있으면 그 태그를, 없으면 새로 만들어 과목에 연결한다. */
export async function adminAddFieldTag(courseId: string, tagName: string): Promise<AdminActionResult> {
  await requireAdmin()
  const name = tagName.trim()
  if (!name) return { ok: false, error: "분야명을 입력해주세요." }

  let [tag] = await db.select({ id: fieldTags.id }).from(fieldTags).where(eq(fieldTags.name, name)).limit(1)
  if (!tag) {
    ;[tag] = await db.insert(fieldTags).values({ name }).returning({ id: fieldTags.id })
  }

  await db.insert(courseFieldTags).values({ courseId, fieldTagId: tag.id }).onConflictDoNothing()
  revalidateCourse(courseId)
  return { ok: true }
}

export async function adminRemoveFieldTag(courseId: string, fieldTagId: string): Promise<AdminActionResult> {
  await requireAdmin()
  await db.delete(courseFieldTags).where(and(eq(courseFieldTags.courseId, courseId), eq(courseFieldTags.fieldTagId, fieldTagId)))
  revalidateCourse(courseId)
  return { ok: true }
}

const EMBEDDING_MODEL = "text-embedding-3-small"

/** PRD 13.4 — 이름이 이미 있으면 그 태그를, 없으면 설명 임베딩까지 만들어 새로 등록한다. */
export async function adminAddIndustryTag(courseId: string, tagName: string, relevanceScore: number): Promise<AdminActionResult> {
  await requireAdmin()
  const name = tagName.trim()
  if (!name) return { ok: false, error: "산업분야명을 입력해주세요." }
  const score = Number.isFinite(relevanceScore) ? Math.min(1, Math.max(0, relevanceScore)) : 1

  let [tag] = await db.select({ id: industryTags.id }).from(industryTags).where(eq(industryTags.name, name)).limit(1)
  if (!tag) {
    let embedding: number[] | null = null
    try {
      const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: name })
      embedding = res.data[0]?.embedding ?? null
    } catch {
      embedding = null
    }
    ;[tag] = await db
      .insert(industryTags)
      .values({ name, description: name, icon: "Sparkles", embedding })
      .returning({ id: industryTags.id })
  }

  await db
    .insert(courseIndustryTags)
    .values({ courseId, industryTagId: tag.id, relevanceScore: score })
    .onConflictDoUpdate({ target: [courseIndustryTags.courseId, courseIndustryTags.industryTagId], set: { relevanceScore: score } })

  revalidateCourse(courseId)
  return { ok: true }
}

export async function adminRemoveIndustryTag(courseId: string, industryTagId: string): Promise<AdminActionResult> {
  await requireAdmin()
  await db.delete(courseIndustryTags).where(and(eq(courseIndustryTags.courseId, courseId), eq(courseIndustryTags.industryTagId, industryTagId)))
  revalidateCourse(courseId)
  return { ok: true }
}
