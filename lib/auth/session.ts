// Server Action 전용 (next/headers의 cookies()를 쓰므로 클라이언트 컴포넌트에서 import하지 않는다).
import { cookies } from "next/headers"
import { ANON_ID_COOKIE } from "@/proxy"

/** 로그인/회원가입 인증 성공 시 그 계정의 anonId를 세션 쿠키 값으로 내려준다. */
export async function createSession(anonId: string): Promise<void> {
  const store = await cookies()
  store.set(ANON_ID_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(ANON_ID_COOKIE)
}
