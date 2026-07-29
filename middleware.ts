import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const ANON_ID_COOKIE = "sgz_anon_id"

// 로그인 없이 브라우저별로 안정적인 익명 식별자를 발급한다 (PRD "개인정보 최소 수집" 원칙).
// 리뷰 작성(F1), 추후 관심분야/기이수과목 저장(F4)에 이 값을 사용한다.
export function middleware(request: NextRequest) {
  if (request.cookies.has(ANON_ID_COOKIE)) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.cookies.set(ANON_ID_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  })
  return response
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
