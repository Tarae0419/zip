// courses.classroom / courses.timeSlots 원문 파싱 + 스케매틱 캠퍼스 지도 좌표 산출.
//
// 실제 강의실 GPS 좌표나 학교 공식 교시(수업시간) 종-시각표는 이 프로젝트에 존재하지 않는다
// (courses.classroom은 "캠퍼스:건물명 호실" 자유 텍스트, courses.timeSlots는
// "요일 교시-A/B" 코드 목록일 뿐이다). 아래 값들은 모두 화면에 노출되는 "추정치"이며,
// 실제 캠퍼스 배치·이동시간과 다를 수 있다는 문구를 CampusMap에서 항상 함께 보여준다.

import type { CampusStop, CartCourse, ClassSession, ParsedLocation, Weekday } from "./types"

const WEEKDAY_CHARS = ["월", "화", "수", "목", "금", "토", "일"] as const
const KNOWN_CAMPUSES = ["전주", "익산", "남원", "고창", "새만금"]

// 1교시 09:00 시작, 매 교시 60분 간격(수업 50분 + 쉬는 10분)이라고 가정한 추정 교시표.
// 학교 공식 종-시각표가 데이터에 없어 도입한 값 — "추정" 문구와 함께 노출해야 한다.
const PERIOD_START_MINUTES = 9 * 60
const PERIOD_LENGTH_MINUTES = 60
const CLASS_MINUTES_PER_PERIOD = 50

function periodStart(period: number): number {
  return PERIOD_START_MINUTES + (period - 1) * PERIOD_LENGTH_MINUTES
}

function periodEnd(period: number): number {
  return periodStart(period) + CLASS_MINUTES_PER_PERIOD
}

/** "2026-1" → "2026학년도 1학기". 형식이 다르면(방학 학기 등) 원문을 그대로 돌려준다. */
export function formatSemesterLabel(semester: string): string {
  const match = semester.match(/^(\d{4})-(\d)$/)
  if (!match) return semester
  return `${match[1]}학년도 ${match[2]}학기`
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** "전주:공과대학 8호관 402 " 같은 원문을 {campus, building, room}으로 파싱한다. 빈 값/미배정은 null. */
export function parseClassroom(classroom: string | null | undefined): ParsedLocation | null {
  if (!classroom) return null
  const raw = classroom.trim()
  if (!raw) return null

  // 드물게 콜론이 두 번 들어간 결측 데이터(":글로벌인재관  전주:글로벌인재관 219")가 있어
  // 마지막 "캠퍼스:나머지" 쌍만 사용한다.
  const parts = raw.split(":")
  const rest = parts[parts.length - 1]?.trim() ?? ""
  const campusRaw = parts.length >= 2 ? parts[parts.length - 2]?.trim() ?? "" : ""
  if (!rest) return null

  const tokens = rest.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  const room = tokens.length > 1 ? tokens[tokens.length - 1] : "-"
  const building = tokens.length > 1 ? tokens.slice(0, -1).join(" ") : tokens[0]
  const campus = KNOWN_CAMPUSES.includes(campusRaw) ? campusRaw : campusRaw || "기타"

  return { campus, building, room }
}

/**
 * "화 6-A,화 6-B,화 7-A,화 7-B,목 8-A,목 8-B" 같은 원문을 요일별 수업 구간으로 변환한다.
 * A/B는 같은 교시를 이루는 30분 단위 서브블록이라 교시 번호만 쓰고, 같은 날 연속된 교시는
 * 하나의 구간으로 합친다(예: 6,7교시 연속 → 09:00~... 아님, 6교시 시작~7교시 끝 한 구간).
 */
export function parseTimeSlots(courseId: string, courseName: string, timeSlots: string | null | undefined): ClassSession[] {
  if (!timeSlots) return []

  const byDay = new Map<Weekday, Set<number>>()
  for (const token of timeSlots.split(",")) {
    const trimmed = token.trim()
    const match = trimmed.match(/^([월화수목금토일])\s*(\d+)-[A-Za-z]$/)
    if (!match) continue
    const day = match[1] as (typeof WEEKDAY_CHARS)[number]
    if (day !== "월" && day !== "화" && day !== "수" && day !== "목" && day !== "금") continue // 토/일은 시간표 탭 범위 밖
    const period = Number(match[2])
    const set = byDay.get(day) ?? new Set<number>()
    set.add(period)
    byDay.set(day, set)
  }

  const sessions: ClassSession[] = []
  for (const [day, periodSet] of byDay) {
    const periods = [...periodSet].sort((a, b) => a - b)
    let runStart = periods[0]
    let prev = periods[0]
    const flushRun = (start: number, end: number) => {
      sessions.push({
        courseId,
        courseName,
        day,
        startMinutes: periodStart(start),
        endMinutes: periodEnd(end),
        location: null, // parseClassroom로 별도 채움 (호출부에서)
      })
    }
    for (let i = 1; i < periods.length; i++) {
      const p = periods[i]
      if (p === prev + 1) {
        prev = p
        continue
      }
      flushRun(runStart, prev)
      runStart = p
      prev = p
    }
    flushRun(runStart, prev)
  }

  return sessions.sort((a, b) => a.startMinutes - b.startMinutes)
}

/** 장바구니 과목 하나의 timeSlots+classroom을 합쳐 위치가 채워진 ClassSession[]으로 변환한다. */
export function buildSessionsForCourse(course: CartCourse): ClassSession[] {
  const location = parseClassroom(course.classroom)
  return parseTimeSlots(course.id, course.name, course.timeSlots).map((session) => ({ ...session, location }))
}

/** 장바구니 전체 과목의 세션을 모아 특정 요일 것만 시간순으로 반환한다. */
export function getSessionsForDay(cart: CartCourse[], day: Weekday): ClassSession[] {
  return cart
    .flatMap((course) => buildSessionsForCourse(course))
    .filter((session) => session.day === day)
    .sort((a, b) => a.startMinutes - b.startMinutes)
}

// 스케매틱 캠퍼스 배치도(0~100 좌표). 실제 GPS·건물 배치가 아니라 도식화한 예시 좌표이며,
// 자주 등장하는 건물군을 대략적인 구역(인문/자연/공과/농생대/의료/예술 등)으로 묶어 배치했다.
const BUILDING_CLUSTERS: { keywords: string[]; cx: number; cy: number }[] = [
  { keywords: ["학생회관", "도서관", "중앙"], cx: 50, cy: 55 },
  { keywords: ["인문대학", "사범대"], cx: 22, cy: 25 },
  { keywords: ["사회과학대학", "경상대학"], cx: 25, cy: 72 },
  { keywords: ["자연과학대학"], cx: 45, cy: 18 },
  { keywords: ["공과대학"], cx: 76, cy: 30 },
  { keywords: ["농업생명과학대학"], cx: 72, cy: 78 },
  { keywords: ["예술대학", "예체능관", "미술관"], cx: 14, cy: 52 },
  { keywords: ["의과대학", "간호대학"], cx: 88, cy: 62 },
  { keywords: ["글로벌인재관", "국제"], cx: 40, cy: 42 },
  { keywords: ["정보화", "창조"], cx: 58, cy: 42 },
]

// 문자열을 결정적(deterministic)으로 정수 해시 — 같은 건물명은 항상 같은 좌표를 얻는다.
function hashString(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = (h * 33 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 건물 하나의 스케매틱 좌표(0~100). 같은 건물명이면 항상 같은 값을 반환한다. */
export function getBuildingPosition(location: ParsedLocation): { x: number; y: number } {
  const key = `${location.campus}|${location.building}`
  const h = hashString(key)

  const cluster = BUILDING_CLUSTERS.find((c) => c.keywords.some((k) => location.building.includes(k)))
  if (cluster) {
    const offsetX = ((h % 17) - 8) * 1.3
    const offsetY = (((h >> 5) % 17) - 8) * 1.3
    return { x: clamp(cluster.cx + offsetX, 5, 95), y: clamp(cluster.cy + offsetY, 5, 95) }
  }

  // 클러스터에 매칭되지 않은 건물(다른 캠퍼스 포함) — 해시 기반 고정 배치로 대체.
  const x = clamp(10 + (h % 81), 5, 95)
  const y = clamp(10 + ((h >> 4) % 81), 5, 95)
  return { x, y }
}

/** 두 건물 간 도보 이동시간 추정치(분). 좌표 거리 기반이며 실측이 아니다. 최소 3분. */
export function estimateWalkMinutes(a: ParsedLocation, b: ParsedLocation): number {
  const pa = getBuildingPosition(a)
  const pb = getBuildingPosition(b)
  const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y)
  return Math.max(3, Math.round(dist * 0.28))
}

function sameLocation(a: ParsedLocation | null, b: ParsedLocation | null): boolean {
  if (!a || !b) return false
  return a.campus === b.campus && a.building === b.building
}

/**
 * 하루치 수업 구간을 시간순으로 훑으며 "연속으로 같은 건물"인 구간을 하나의 정류지로 묶는다.
 * 지도의 ①②③ 번호와 화살표는 이 정류지 목록 순서를 따른다. 강의실 미배정 구간은 제외한다.
 */
export function buildCampusStops(sessions: ClassSession[]): CampusStop[] {
  const sorted = [...sessions].sort((a, b) => a.startMinutes - b.startMinutes)
  const stops: CampusStop[] = []

  for (const session of sorted) {
    if (!session.location) continue
    const last = stops[stops.length - 1]
    if (last && sameLocation(last.location, session.location)) {
      last.sessions.push(session)
      continue
    }
    stops.push({ order: stops.length + 1, location: session.location, sessions: [session] })
  }

  return stops
}

/** 정류지들이 서로 다른 캠퍼스(전주/익산/...)에 걸쳐 있는지 — 걸쳐 있으면 도보 지도가 무의미하다. */
export function spansMultipleCampuses(stops: CampusStop[]): boolean {
  const campuses = new Set(stops.map((s) => s.location.campus))
  return campuses.size > 1
}
