"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"

/** PRD 8.3 요구사항 5 — "내 전공 과목" 판단 기준이 되는 소속 학과를 저장한다. */
export async function setMyDepartment(department: string): Promise<void> {
  const anonId = await getAnonId()
  await ensureAnonUser(anonId)
  await db.update(users).set({ department }).where(eq(users.anonId, anonId))
  revalidatePath("/fields")
}
