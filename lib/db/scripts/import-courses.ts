// 개설 교과목 목록 엑셀(수강편람)을 courses / course_department_tracks 테이블에 적재한다.
// 실행: pnpm db:import-courses
import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { and, eq, isNull } from "drizzle-orm"
import * as XLSX from "xlsx"

import { courseDepartmentTracks, courses, type requirementTypeEnum } from "../schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

// 원본 엑셀은 repo 루트가 아니라 course/ 폴더에 둔다(2026-07-30 재정리 — 교양 파일 추가되며 폴더로 모음).
const SOURCES: { file: string; semester: string }[] = [
  { file: "course/2026_1학기_학부전공_개설교과목_목록.xlsx", semester: "2026-1" },
  { file: "course/2026_2학기_학부전공_개설교과목_목록.xlsx", semester: "2026-2" },
  { file: "course/2026_1학기_교양.xlsx", semester: "2026-1" },
  { file: "course/2026_2학기_교양.xlsx", semester: "2026-2" },
  { file: "course/2026_1학기_교직.xlsx", semester: "2026-1" },
  { file: "course/2026_2학기_교직.xlsx", semester: "2026-2" },
  { file: "course/2026_1학기_군사학.xlsx", semester: "2026-1" },
  { file: "course/2026_2학기_군사학.xlsx", semester: "2026-2" },
  { file: "course/2026_1학기_일반선택.xlsx", semester: "2026-1" },
  { file: "course/2026_2학기_일반선택.xlsx", semester: "2026-2" },
]

type RequirementType = (typeof requirementTypeEnum.enumValues)[number]
const VALID_REQUIREMENT_TYPES = new Set<string>([
  "전공필수",
  "전공선택",
  "기초필수",
  "계열공통",
  "교양",
  "일반선택",
  "교직",
  "군사학",
])

type ParsedRow = typeof courses.$inferInsert
type ParsedTrack = Omit<typeof courseDepartmentTracks.$inferInsert, "courseId">

function parseDepartmentTracks(raw: unknown): ParsedTrack[] {
  if (typeof raw !== "string" || !raw.trim()) return []
  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(.*?)\s*(\d+)$/)
      if (match) {
        return { departmentLabel: match[1].trim(), grade: Number(match[2]) }
      }
      return { departmentLabel: segment, grade: null }
    })
}

function parseRow(row: unknown[], semester: string): { course: ParsedRow; tracks: ParsedTrack[] } | null {
  const [
    requirementTypeRaw,
    enrolledCount,
    _allowedCount,
    capacity,
    isPublicRaw,
    _hiddenReason,
    code,
    name,
    section,
    credits,
    hours,
    professor,
    language,
    _fieldGeneral,
    _fieldDetail,
    _swGeneral,
    gradingType,
    _deliveryDirection,
    certificationType,
    targetStudents,
    deliveryType,
    classroom,
    timeSlots,
    department,
    sessionInfo,
    departmentGradeInfo,
  ] = row

  // 군사학 2026-2학기 원본은 학과 컬럼이 통째로 비어 있다 — 1학기 데이터에서 군사학 전 row가
  // 예외 없이 "교무처 학사지원과" 소속이었으므로, 이 이수구분에 한해서만 안전하게 채워 넣는다.
  // 일반선택은 학과가 다양해(원예학과/약학과/체육교육과 등) 같은 방식으로 추론할 수 없어 그대로 스킵한다.
  const resolvedDepartment = !department && requirementTypeRaw === "군사학" ? "교무처 학사지원과" : department

  if (!name || typeof name !== "string") return null
  if (!resolvedDepartment || typeof resolvedDepartment !== "string") return null
  if (typeof credits !== "number" || typeof section !== "number") return null
  if (typeof requirementTypeRaw !== "string" || !VALID_REQUIREMENT_TYPES.has(requirementTypeRaw)) return null

  const course: ParsedRow = {
    code: typeof code === "string" ? code : null,
    section,
    name,
    department: resolvedDepartment,
    professor: typeof professor === "string" ? professor : null,
    credits,
    hours: typeof hours === "number" ? hours : null,
    requirementType: requirementTypeRaw as RequirementType,
    language: typeof language === "string" ? language : null,
    gradingType: typeof gradingType === "string" ? gradingType : null,
    certificationType: typeof certificationType === "string" ? certificationType : null,
    targetStudents: typeof targetStudents === "string" ? targetStudents : null,
    deliveryType: typeof deliveryType === "string" ? deliveryType : null,
    classroom: typeof classroom === "string" ? classroom : null,
    timeSlots: typeof timeSlots === "string" ? timeSlots : null,
    sessionInfo: typeof sessionInfo === "string" ? sessionInfo : null,
    capacity: typeof capacity === "number" ? capacity : null,
    enrolledCount: typeof enrolledCount === "number" ? enrolledCount : null,
    isPublic: isPublicRaw === "Y",
    semester,
  }

  return { course, tracks: parseDepartmentTracks(departmentGradeInfo) }
}

async function insertOne(entry: { course: ParsedRow; tracks: ParsedTrack[] }) {
  // courses_code_section_semester_idx는 code가 NULL인 row끼리 서로 다르다고 취급한다(Postgres 유니크
  // 인덱스의 NULL 시맨틱) — onConflictDoNothing만 믿으면 학수번호 없는 과목은 재실행할 때마다 계속
  // 새 row로 중복 삽입된다(2026-07-30에 실제로 겪은 문제, SPRINT_PLAN 오픈 이슈 로그 참고).
  // code가 없는 행은 (교과목명, 개설학과, 분반, 학기)로 먼저 존재 여부를 직접 확인한다.
  if (!entry.course.code) {
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(
          isNull(courses.code),
          eq(courses.name, entry.course.name),
          eq(courses.department, entry.course.department),
          eq(courses.section, entry.course.section),
          eq(courses.semester, entry.course.semester),
        ),
      )
      .limit(1)
    if (existing) return "skipped_conflict" as const
  }

  const [inserted] = await db
    .insert(courses)
    .values(entry.course)
    .onConflictDoNothing({ target: [courses.code, courses.section, courses.semester] })
    .returning({ id: courses.id })

  if (!inserted) return "skipped_conflict" as const

  if (entry.tracks.length > 0) {
    await db
      .insert(courseDepartmentTracks)
      .values(entry.tracks.map((t) => ({ courseId: inserted.id, departmentLabel: t.departmentLabel, grade: t.grade })))
  }
  return "inserted" as const
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  async function next(): Promise<void> {
    const i = cursor++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  await Promise.all(Array.from({ length: limit }, next))
}

async function main() {
  let totalInserted = 0
  let totalConflictSkipped = 0
  let totalMalformedSkipped = 0

  for (const { file, semester } of SOURCES) {
    console.log(`\n=== ${file} (${semester}) ===`)
    const wb = XLSX.readFile(file)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][]
    const dataRows = rows.slice(1)

    const parsed = dataRows.map((r) => parseRow(r, semester))
    const malformed = parsed.filter((p) => p === null).length
    const valid = parsed.filter((p): p is NonNullable<typeof p> => p !== null)

    console.log(`parsed ${valid.length} rows, skipped ${malformed} malformed rows`)

    let done = 0
    await runWithConcurrency(valid, 15, async (entry) => {
      const result = await insertOne(entry)
      if (result === "inserted") totalInserted++
      else totalConflictSkipped++
      done++
      if (done % 500 === 0) console.log(`  ...${done}/${valid.length}`)
    })

    totalMalformedSkipped += malformed
  }

  console.log(
    `\n총 삽입: ${totalInserted}건, 중복 스킵: ${totalConflictSkipped}건, 형식오류 스킵: ${totalMalformedSkipped}건`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
