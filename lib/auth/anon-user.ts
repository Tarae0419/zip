// Server Component / Server Action 전용. next/headers를 쓰므로 클라이언트 컴포넌트에서 import하지 않는다.
import { cookies } from "next/headers"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { ANON_ID_COOKIE } from "@/middleware"

/** middleware.ts가 모든 요청에 대해 쿠키를 발급하므로, 이 함수는 항상 값을 반환한다고 가정한다. */
export async function getAnonId(): Promise<string> {
  const store = await cookies()
  const id = store.get(ANON_ID_COOKIE)?.value
  if (!id) {
    throw new Error(`${ANON_ID_COOKIE} 쿠키가 없습니다 — middleware가 실행되지 않은 경로인지 확인하세요.`)
  }
  return id
}

/** users 테이블에 해당 익명 사용자 레코드가 없으면 생성한다. */
export async function ensureAnonUser(anonId: string): Promise<void> {
  await db.insert(users).values({ anonId }).onConflictDoNothing({ target: users.anonId })
}
