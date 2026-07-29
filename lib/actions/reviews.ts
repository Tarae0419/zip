"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { courses, reviews } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"

export type SubmitReviewInput = {
  courseId: string
  rating: number
  body: string
  hashtags: string[]
}

export type SubmitReviewResult = { ok: true } | { ok: false; error: string }

const MAX_HASHTAGS = 6
const MAX_BODY_LENGTH = 2000

/**
 * 동일 사용자가 같은 과목(학기가 달라도 같은 학수번호)에 이미 리뷰를 남긴 적이 있으면
 * 도배성 재등록으로 간주해 필터링한다 (PRD 8.1 요구사항 7 — 최소 규칙, Sprint 1 범위).
 */
async function isRepeatSubmission(anonId: string, courseId: string): Promise<boolean> {
  const [target] = await db.select({ code: courses.code, name: courses.name }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!target) return false

  const siblingIds = target.code
    ? (await db.select({ id: courses.id }).from(courses).where(eq(courses.code, target.code))).map((r) => r.id)
    : (await db.select({ id: courses.id }).from(courses).where(eq(courses.name, target.name))).map((r) => r.id)

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.authorAnonId, anonId), inArray(reviews.courseId, siblingIds)))
    .limit(1)

  return Boolean(existing)
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

  const [course] = await db.select({ id: courses.id, semester: courses.semester }).from(courses).where(eq(courses.id, input.courseId)).limit(1)
  if (!course) {
    return { ok: false, error: "존재하지 않는 과목이에요." }
  }

  const anonId = await getAnonId()
  await ensureAnonUser(anonId)

  const isFiltered = await isRepeatSubmission(anonId, input.courseId)

  await db.insert(reviews).values({
    courseId: input.courseId,
    authorAnonId: anonId,
    rating: input.rating,
    body,
    hashtags: input.hashtags.slice(0, MAX_HASHTAGS),
    semester: course.semester,
    isFiltered,
  })

  revalidatePath(`/courses/${input.courseId}`)
  revalidatePath("/")

  if (isFiltered) {
    return { ok: false, error: "이미 이 과목에 리뷰를 남기셨어요. 중복 등록은 반영되지 않아요." }
  }
  return { ok: true }
}
