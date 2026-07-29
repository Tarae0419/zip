// Server Action 전용 (next/headers의 cookies()를 쓰므로 클라이언트 컴포넌트에서 import하지 않는다).
import { cookies } from "next/headers"
import { ANON_ID_COOKIE } from "@/proxy"

/**
 * 로그인/회원가입 인증 성공 시 그 계정의 anonId를 세션 쿠키 값으로 내려준다.
 * persistent=false면 만료시간을 아예 안 줘서 브라우저를 닫으면 사라지는 세션 쿠키가 된다
 * ("자동 로그인" 체크 안 했을 때). persistent=true(기본값)면 2년짜리 쿠키.
 */
export async function createSession(anonId: string, persistent = true): Promise<void> {
  const store = await cookies()
  store.set(ANON_ID_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(persistent ? { maxAge: 60 * 60 * 24 * 365 * 2 } : {}),
    path: "/",
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(ANON_ID_COOKIE)
}
