"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth/admin"

export type AdminActionResult = { ok: true } | { ok: false; error: string }

/** PRD 13.7 — 어뷰징 계정 정지/복구. 삭제 대신 로그인만 막는다(리뷰 등 기존 데이터는 그대로 둠). */
export async function adminSetUserStatus(userId: string, status: "active" | "suspended"): Promise<AdminActionResult> {
  await requireAdmin()
  await db.update(users).set({ status }).where(eq(users.id, userId))
  revalidatePath("/admin/users")
  return { ok: true }
}

/** PRD 13.2/13.7 — 관리자 권한 부여/회수. 자기 자신의 관리자 권한 회수는 막는다(관리자가 0명이 되는 사고 방지). */
export async function adminSetUserRole(userId: string, role: "user" | "admin"): Promise<AdminActionResult> {
  const currentAdminAnonId = await requireAdmin()

  const [target] = await db.select({ id: users.id, anonId: users.anonId }).from(users).where(eq(users.id, userId)).limit(1)
  if (!target) return { ok: false, error: "사용자를 찾을 수 없어요." }
  if (role === "user" && target.anonId === currentAdminAnonId) {
    return { ok: false, error: "본인의 관리자 권한은 스스로 회수할 수 없어요." }
  }

  await db.update(users).set({ role }).where(eq(users.id, userId))
  revalidatePath("/admin/users")
  return { ok: true }
}
