import { NextResponse, type NextRequest } from "next/server"

import { parseTmapWalkingRequest } from "@/lib/timetable/tmap-contract"
import { tmapWalkingService } from "@/lib/timetable/tmap-server"
import { ANON_ID_COOKIE } from "@/proxy"

export const runtime = "nodejs"

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const RATE_LIMIT_MAX_SUBJECTS = 2_000
const MAX_REQUEST_BODY_BYTES = 4_096
const rateWindows = new Map<string, { count: number; resetAt: number }>()

function consumeRateLimit(subject: string, now = Date.now()): number | null {
  const current = rateWindows.get(subject)
  if (!current || current.resetAt <= now) {
    rateWindows.set(subject, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return null
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000))
  }
  current.count += 1
  return null
}

function trimRateWindows(now: number): void {
  if (rateWindows.size < RATE_LIMIT_MAX_SUBJECTS) return
  for (const [subject, window] of rateWindows) {
    if (window.resetAt <= now) rateWindows.delete(subject)
  }
  while (rateWindows.size >= RATE_LIMIT_MAX_SUBJECTS) {
    const oldestSubject = rateWindows.keys().next().value
    if (typeof oldestSubject !== "string") break
    rateWindows.delete(oldestSubject)
  }
}

export async function POST(request: NextRequest) {
  const subject = request.cookies.get(ANON_ID_COOKIE)?.value
  if (!subject || subject.length > 64) {
    return NextResponse.json(
      { error: "AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (process.env.TMAP_ROUTE_ENABLED === "false") {
    return NextResponse.json(
      { error: "TMAP_DISABLED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const contentType = request.headers.get("content-type") ?? ""
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (
    !contentType.toLowerCase().startsWith("application/json") ||
    (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES)
  ) {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const now = Date.now()
  trimRateWindows(now)
  const retryAfter = consumeRateLimit(subject, now)
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
    )
  }

  const rawBody = await request.text().catch(() => "")
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }
  const body = (() => {
    try {
      return JSON.parse(rawBody) as unknown
    } catch {
      return null
    }
  })()
  const parsed = parseTmapWalkingRequest(body)
  if (!parsed) {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const result = await tmapWalkingService.resolve(parsed.legs)
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
}
