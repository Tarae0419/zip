// Server Component / Server Action 전용 (getAnonId가 next/headers를 씀).
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { getAnonId } from "@/lib/auth/anon-user"

/** 현재 세션이 관리자면 그 anonId를, 아니면 null을 반환한다. 라우트 가드(app/admin/layout.tsx)에서 사용. */
export async function getCurrentAdminAnonId(): Promise<string | null> {
  const anonId = await getAnonId()
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.anonId, anonId)).limit(1)
  return row?.role === "admin" ? anonId : null
}

/**
 * 관리자 전용 Server Action의 첫 줄에서 호출한다. Server Action은 레이아웃 가드와 별개로 직접
 * 호출될 수 있으므로(예: devtools), 액션 안에서도 매번 다시 권한을 확인해야 한다.
 * 관리자가 아니면 던진다.
 */
export async function requireAdmin(): Promise<string> {
  const anonId = await getCurrentAdminAnonId()
  if (!anonId) {
    throw new Error("관리자 권한이 필요합니다.")
  }
  return anonId
}
