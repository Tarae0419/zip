// 과목명 기반 AI 1차 학문분야 분류 (PRD 8.2 요구사항 3).
// DB에 바로 쓰지 않고 검수용 JSON 파일로만 출력한다 — 검수/수정 후 apply-field-classification.ts로 적용한다.
// 실행: pnpm db:classify-fields
import fs from "node:fs/promises"
import { isNotNull } from "drizzle-orm"
import { db } from "../client"
import { courses, fieldTags } from "../schema"
import { AI_MODEL, openai } from "../../ai/openai-client"

const OUTPUT_PATH = "lib/db/scripts/field-classification-result.json"
const BATCH_SIZE = 25
const CONCURRENCY = 8

type Subject = { key: string; name: string; courseIds: string[] }
type ClassificationResult = { key: string; name: string; courseIds: string[]; tags: string[] }

async function loadSubjects(): Promise<Subject[]> {
  const rows = await db.select({ id: courses.id, code: courses.code, name: courses.name }).from(courses)
  const grouped = new Map<string, Subject>()
  for (const row of rows) {
    const key = row.code ?? `name:${row.name}`
    const existing = grouped.get(key)
    if (existing) {
      existing.courseIds.push(row.id)
    } else {
      grouped.set(key, { key, name: row.name, courseIds: [row.id] })
    }
  }
  return [...grouped.values()]
}

async function loadAllowedTags(): Promise<string[]> {
  const rows = await db.select({ name: fieldTags.name }).from(fieldTags).where(isNotNull(fieldTags.parentId))
  return rows.map((r) => r.name)
}

function buildSystemPrompt(allowedTags: string[]): string {
  return `너는 대학 과목명을 보고 학문분야를 분류하는 도우미야. 아래 "허용 태그 목록"에 있는 값만 사용해야 해.
과목명 하나당 가장 관련 있는 태그를 최대 2개까지 고르고, 확신이 없으면 빈 배열을 반환해. 새로운 태그를 만들어내지 마.

허용 태그 목록: ${allowedTags.join(", ")}

입력은 번호가 매겨진 과목명 목록이야. 반드시 다음 JSON 형식으로만 응답해:
{"results": [{"i": 1, "tags": ["태그1"]}, {"i": 2, "tags": []}, ...]}
모든 입력 번호에 대해 결과를 하나씩 반드시 포함해.`
}

async function classifyBatch(batch: Subject[], allowedTagSet: Set<string>, systemPrompt: string): Promise<Map<number, string[]>> {
  const userContent = batch.map((s, i) => `${i + 1}. ${s.name}`).join("\n")

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  })

  const raw = completion.choices[0]?.message?.content
  const out = new Map<number, string[]>()
  if (!raw) return out

  try {
    const parsed = JSON.parse(raw) as { results?: unknown }
    if (!Array.isArray(parsed.results)) return out
    for (const entry of parsed.results) {
      if (typeof entry !== "object" || entry === null) continue
      const { i, tags } = entry as { i?: unknown; tags?: unknown }
      if (typeof i !== "number" || !Array.isArray(tags)) continue
      const valid = tags.filter((t): t is string => typeof t === "string" && allowedTagSet.has(t))
      out.set(i, valid)
    }
  } catch {
    // 파싱 실패 시 이 배치는 빈 결과로 남기고 다음 배치로 진행한다.
  }
  return out
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0
  async function next(): Promise<void> {
    const i = cursor++
    if (i >= items.length) return
    await worker(items[i], i)
    return next()
  }
  await Promise.all(Array.from({ length: limit }, () => next()))
}

async function main() {
  const [subjects, allowedTags] = await Promise.all([loadSubjects(), loadAllowedTags()])
  const allowedTagSet = new Set(allowedTags)
  const systemPrompt = buildSystemPrompt(allowedTags)

  console.log(`분류 대상 과목(고유): ${subjects.length}개, 허용 태그: ${allowedTags.length}개`)

  const batches: Subject[][] = []
  for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
    batches.push(subjects.slice(i, i + BATCH_SIZE))
  }

  const results: ClassificationResult[] = []
  let done = 0

  await runWithConcurrency(batches, CONCURRENCY, async (batch) => {
    const classified = await classifyBatch(batch, allowedTagSet, systemPrompt)
    batch.forEach((subject, i) => {
      const tags = classified.get(i + 1) ?? []
      if (tags.length > 0) {
        results.push({ key: subject.key, name: subject.name, courseIds: subject.courseIds, tags })
      }
    })
    done++
    if (done % 10 === 0 || done === batches.length) {
      console.log(`  배치 ${done}/${batches.length} 완료`)
    }
  })

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8")
  console.log(`\n분류 완료: ${results.length}/${subjects.length}개 과목에 태그 부여됨`)
  console.log(`결과 저장: ${OUTPUT_PATH}`)
  console.log(`검수 후 'pnpm db:apply-field-classification'으로 DB에 반영하세요.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
