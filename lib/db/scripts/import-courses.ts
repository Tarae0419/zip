// 개설 교과목 목록 엑셀(수강편람)을 courses / course_department_tracks 테이블에 적재한다.
// 실행: pnpm db:import-courses
import { config } from "dotenv"
config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as XLSX from "xlsx"

import { courseDepartmentTracks, courses, type requirementTypeEnum } from "../schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

const SOURCES: { file: string; semester: string }[] = [
  { file: "2026_1학기_학부전공_개설교과목_목록.xlsx", semester: "2026-1" },
  { file: "2026_2학기_학부전공_개설교과목_목록.xlsx", semester: "2026-2" },
]

type RequirementType = (typeof requirementTypeEnum.enumValues)[number]
const VALID_REQUIREMENT_TYPES = new Set<string>(["전공필수", "전공선택", "기초필수", "계열공통", "교양"])

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

  if (!name || typeof name !== "string") return null
  if (!department || typeof department !== "string") return null
  if (typeof credits !== "number" || typeof section !== "number") return null
  if (typeof requirementTypeRaw !== "string" || !VALID_REQUIREMENT_TYPES.has(requirementTypeRaw)) return null

  const course: ParsedRow = {
    code: typeof code === "string" ? code : null,
    section,
    name,
    department,
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
