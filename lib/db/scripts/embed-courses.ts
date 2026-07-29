// 과목명 임베딩 생성 (PRD 10.3, F3 연관도 스코어링의 입력).
// 학기별 row가 아니라 "고유 과목"(학수번호 기준) 하나당 임베딩 하나만 만들어 대표(canonical) row에 저장한다.
// 실행: pnpm db:embed-courses
import { db } from "../client"
import { courseEmbeddings, courses } from "../schema"
import { openai } from "../../ai/openai-client"

const EMBEDDING_MODEL = "text-embedding-3-small"
const BATCH_SIZE = 300
const CONCURRENCY = 5

type Subject = { key: string; name: string; courseIds: string[]; canonicalId: string }

async function loadSubjects(): Promise<Subject[]> {
  const rows = await db.select({ id: courses.id, code: courses.code, name: courses.name, semester: courses.semester }).from(courses)
  const grouped = new Map<string, { name: string; entries: { id: string; semester: string }[] }>()
  for (const row of rows) {
    const key = row.code ?? `name:${row.name}`
    const existing = grouped.get(key)
    if (existing) existing.entries.push({ id: row.id, semester: row.semester })
    else grouped.set(key, { name: row.name, entries: [{ id: row.id, semester: row.semester }] })
  }
  return [...grouped.entries()].map(([key, { name, entries }]) => {
    // 학기 문자열("2026-2" > "2026-1")이 가장 큰, 즉 가장 최근 학기 row를 대표로 삼는다 (Sprint 2의 getCanonicalCourseId와 동일 기준).
    const canonical = entries.reduce((a, b) => (b.semester > a.semester ? b : a))
    return { key, name, courseIds: entries.map((e) => e.id), canonicalId: canonical.id }
  })
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  async function next(): Promise<void> {
    const i = cursor++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  await Promise.all(Array.from({ length: limit }, () => next()))
}

async function main() {
  const subjects = await loadSubjects()
  console.log(`임베딩 대상 고유 과목: ${subjects.length}개`)

  const batches: Subject[][] = []
  for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
    batches.push(subjects.slice(i, i + BATCH_SIZE))
  }

  let done = 0
  let saved = 0

  await runWithConcurrency(batches, CONCURRENCY, async (batch) => {
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((s) => s.name),
    })

    const rows: (typeof courseEmbeddings.$inferInsert)[] = batch.map((s, i) => ({
      courseId: s.canonicalId,
      embedding: res.data[i].embedding,
    }))

    for (const row of rows) {
      await db
        .insert(courseEmbeddings)
        .values(row)
        .onConflictDoUpdate({ target: courseEmbeddings.courseId, set: { embedding: row.embedding } })
    }
    saved += rows.length

    done++
    if (done % 3 === 0 || done === batches.length) {
      console.log(`  배치 ${done}/${batches.length} 완료 (누적 저장 ${saved}건)`)
    }
  })

  console.log(`\n임베딩 저장 완료: ${saved}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
