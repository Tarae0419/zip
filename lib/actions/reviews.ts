"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, ne } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { courses, reviews, summaries } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"
import { getCanonicalCourseId, getSiblingCourseIds } from "@/lib/db/queries"
import { suggestHashtags } from "@/lib/ai/hashtags"
import { generateCourseSummary } from "@/lib/ai/summary"

export type SubmitReviewInput = {
  courseId: string
  rating: number
  body: string
  hashtags: string[]
}

export type SubmitReviewResult = { ok: true } | { ok: false; error: string }

const MAX_HASHTAGS = 6
const MAX_BODY_LENGTH = 2000
// PRD 8.1 — 리뷰 5개 이상부터 AI 요약 제공. 매 리뷰마다 재생성하지 않고 일정 수 누적될 때만 재생성한다.
const MIN_REVIEWS_FOR_SUMMARY = 5
const SUMMARY_REGEN_INCREMENT = 3

/**
 * 동일 사용자가 같은 과목(학기가 달라도 같은 학수번호)에 이미 리뷰를 남긴 적이 있으면
 * 도배성 재등록으로 간주해 필터링한다 (PRD 8.1 요구사항 7 — 최소 규칙, Sprint 1 범위).
 */
async function isRepeatSubmission(anonId: string, siblingIds: string[]): Promise<boolean> {
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.authorAnonId, anonId), inArray(reviews.courseId, siblingIds)))
    .limit(1)
  return Boolean(existing)
}

/** 유효(비필터링) 리뷰가 임계값 이상 쌓였고, 마지막 생성 이후 충분히 늘었으면 AI 요약을 재생성한다. */
async function maybeRegenerateSummary(siblingIds: string[], courseName: string, professor: string | null) {
  const validReviews = await db
    .select({ rating: reviews.rating, body: reviews.body, hashtags: reviews.hashtags })
    .from(reviews)
    .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.isFiltered, false)))

  if (validReviews.length < MIN_REVIEWS_FOR_SUMMARY) return

  const canonicalId = await getCanonicalCourseId(siblingIds)
  if (!canonicalId) return

  const [existingSummary] = await db
    .select({ basedReviewCount: summaries.basedReviewCount })
    .from(summaries)
    .where(eq(summaries.courseId, canonicalId))
    .limit(1)

  const shouldRegenerate = !existingSummary || validReviews.length - existingSummary.basedReviewCount >= SUMMARY_REGEN_INCREMENT
  if (!shouldRegenerate) return

  try {
    const summaryText = await generateCourseSummary(
      courseName,
      professor,
      validReviews.map((r) => ({ rating: r.rating, body: r.body, hashtags: (r.hashtags as string[]) ?? [] })),
    )
    if (!summaryText) return

    // 학기가 바뀌며 "대표 row"가 달라질 수 있으니, 다른 형제 row에 붙어있던 예전 요약은 정리한다.
    await db.delete(summaries).where(and(inArray(summaries.courseId, siblingIds), ne(summaries.courseId, canonicalId)))

    await db
      .insert(summaries)
      .values({ courseId: canonicalId, body: summaryText, basedReviewCount: validReviews.length })
      .onConflictDoUpdate({
        target: summaries.courseId,
        set: { body: summaryText, basedReviewCount: validReviews.length, generatedAt: new Date() },
      })
  } catch (err) {
    // AI 요약 생성 실패가 리뷰 등록 자체를 막아서는 안 된다.
    console.error("AI 요약 생성 실패:", err)
  }
}

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "별점은 1~5 사이로 선택해주세요." }
  }
  const body = input.body.trim()
  if (!body) {
    return { ok: false, error: "리뷰 내용을 입력해주세요." }
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { ok: false, error: `리뷰는 ${MAX_BODY_LENGTH}자 이내로 작성해주세요.` }
  }

  const [course] = await db
    .select({ id: courses.id, semester: courses.semester, code: courses.code, name: courses.name, professor: courses.professor })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1)
  if (!course) {
    return { ok: false, error: "존재하지 않는 과목이에요." }
  }

  const anonId = await getAnonId()
  await ensureAnonUser(anonId)

  const siblingIds = await getSiblingCourseIds(course)
  const isFiltered = await isRepeatSubmission(anonId, siblingIds)

  await db.insert(reviews).values({
    courseId: input.courseId,
    authorAnonId: anonId,
    rating: input.rating,
    body,
    hashtags: input.hashtags.slice(0, MAX_HASHTAGS),
    semester: course.semester,
    isFiltered,
  })

  if (!isFiltered) {
    await maybeRegenerateSummary(siblingIds, course.name, course.professor)
  }

  revalidatePath(`/courses/${input.courseId}`)
  revalidatePath("/")

  if (isFiltered) {
    return { ok: false, error: "이미 이 과목에 리뷰를 남기셨어요. 중복 등록은 반영되지 않아요." }
  }
  return { ok: true }
}

/** PRD 8.1 요구사항 2 — 리뷰 본문을 바탕으로 AI 해시태그 후보를 추천한다. 실패해도 빈 배열로 조용히 넘어간다. */
export async function suggestReviewHashtags(body: string): Promise<string[]> {
  try {
    return await suggestHashtags(body)
  } catch (err) {
    console.error("AI 해시태그 추천 실패:", err)
    return []
  }
}

/**
 * 본인이 작성한 리뷰만 삭제할 수 있다 — authorAnonId가 현재 세션과 일치하는지 서버에서 직접
 * 확인한다(클라이언트가 보낸 값을 신뢰하지 않고, 쿠키로 식별되는 anonId만 기준으로 삼는다).
 * 삭제로 리뷰 수가 줄어도 AI 요약은 그대로 둔다 — submitReview와 마찬가지로 늘어날 때만
 * 재생성한다(감소를 매번 반영하면 비용 대비 이득이 적다). 화면은 reviewCount가 줄면 요약 카드
 * 자체를 숨기는 기존 분기(course.reviewCount < MIN_REVIEWS_FOR_SUMMARY)로 이미 처리된다.
 */
export async function deleteReview(reviewId: string): Promise<SubmitReviewResult> {
  const anonId = await getAnonId()

  const [review] = await db
    .select({ id: reviews.id, authorAnonId: reviews.authorAnonId, courseId: reviews.courseId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review) {
    return { ok: false, error: "이미 삭제된 리뷰예요." }
  }
  if (review.authorAnonId !== anonId) {
    return { ok: false, error: "본인이 작성한 리뷰만 삭제할 수 있어요." }
  }

  await db.delete(reviews).where(eq(reviews.id, reviewId))

  revalidatePath(`/courses/${review.courseId}`)
  revalidatePath("/")
  return { ok: true }
}
