"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { reviews } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth/admin"

export type AdminActionResult = { ok: true } | { ok: false; error: string }

/** PRD 13.3 — 관리자가 리뷰를 수동으로 숨기거나(신고 접수 등) 복원한다. */
export async function adminSetReviewFiltered(reviewId: string, filtered: boolean): Promise<AdminActionResult> {
  await requireAdmin()

  const [review] = await db.select({ id: reviews.id, courseId: reviews.courseId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1)
  if (!review) {
    return { ok: false, error: "리뷰를 찾을 수 없어요." }
  }

  await db.update(reviews).set({ isFiltered: filtered }).where(eq(reviews.id, reviewId))

  revalidatePath(`/courses/${review.courseId}`)
  revalidatePath("/")
  revalidatePath("/admin/reviews")
  return { ok: true }
}

/** PRD 13.3 — 관리자 강제 삭제(작성자 본인 확인 없이). */
export async function adminDeleteReview(reviewId: string): Promise<AdminActionResult> {
  await requireAdmin()

  const [review] = await db.select({ id: reviews.id, courseId: reviews.courseId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1)
  if (!review) {
    return { ok: false, error: "이미 삭제된 리뷰예요." }
  }

  await db.delete(reviews).where(eq(reviews.id, reviewId))

  revalidatePath(`/courses/${review.courseId}`)
  revalidatePath("/")
  revalidatePath("/admin/reviews")
  return { ok: true }
}
