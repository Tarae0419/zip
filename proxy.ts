import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const ANON_ID_COOKIE = "sgz_anon_id"

// 학번 회원가입 + 이메일 인증(@jbnu.ac.kr)을 도입하면서 "로그인 필수" 앱으로 전환했다.
// 예전에는 이 미들웨어가 방문자 전원에게 익명 쿠키를 자동 발급했지만, 이제 그 쿠키(세션)는
// login/signup 서버 액션이 인증에 성공했을 때만 내려준다(lib/auth/session.ts) — 여기서는
// 쿠키 유무만 보고 없으면 /welcome(비로그인 방문자용 랜딩 페이지)으로 보낸다.
const PUBLIC_PATHS = ["/welcome", "/login", "/signup"]
const STATIC_FILE_RE = /\.(svg|png|ico|jpg|jpeg|webmanifest|xml|txt)$/

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || STATIC_FILE_RE.test(pathname)
  if (isPublic) {
    return NextResponse.next()
  }

  if (!request.cookies.has(ANON_ID_COOKIE)) {
    return NextResponse.redirect(new URL("/welcome", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
