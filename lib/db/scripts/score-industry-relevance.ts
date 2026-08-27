// pgvector 코사인 유사도로 과목-산업분야 연관도를 계산한다 (PRD 10.3, F3 요구사항 3).
// DB에 바로 쓰지 않고 검수용 JSON으로 출력한다(Sprint 3의 2단계 검수 패턴과 동일).
// 실행: pnpm db:score-industry-relevance
import fs from "node:fs/promises"
import { sql } from "drizzle-orm"
import { db } from "../client"
import { industryTags } from "../schema"

const OUTPUT_PATH = "lib/db/scripts/industry-relevance-result.json"
const TOP_K_PER_TAG = 40
// 0.3에서는 "금속재료분석학"이 금융·핀테크로 잡히는 등 명백한 오탐이 섞여 0.4로 올렸다(score-industry-relevance 실행 로그 참고).
const MIN_SCORE = 0.4

type RelevanceRow = { tagName: string; courseId: string; courseName: string; department: string; score: number }

async function main() {
  const tags = await db.select({ id: industryTags.id, name: industryTags.name, embedding: industryTags.embedding }).from(industryTags)

  const results: RelevanceRow[] = []

  for (const tag of tags) {
    if (!tag.embedding) {
      console.warn(`임베딩 없음, 스킵: ${tag.name}`)
      continue
    }
    const vecLiteral = JSON.stringify(tag.embedding)

    const rows = await db.execute(sql`
      select
        ce.course_id as course_id,
        c.name as course_name,
        c.department as department,
        1 - (ce.embedding <=> ${vecLiteral}::vector) as score
      from course_embeddings ce
      join courses c on c.id = ce.course_id
      order by ce.embedding <=> ${vecLiteral}::vector
      limit ${TOP_K_PER_TAG}
    `)

    const topRows = rows.rows as { course_id: string; course_name: string; department: string; score: number }[]
    console.log(`\n=== ${tag.name} — 상위 10개 (원점수, 필터 전) ===`)
    topRows.slice(0, 10).forEach((r) => console.log(`  ${Number(r.score).toFixed(3)}  ${r.course_name} [${r.department}]`))

    for (const r of topRows) {
      const score = Number(r.score)
      if (score < MIN_SCORE) continue
      results.push({ tagName: tag.name, courseId: r.course_id, courseName: r.course_name, department: r.department, score })
    }
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8")
  console.log(`\n총 ${results.length}건 (임계값 ${MIN_SCORE} 이상) 저장: ${OUTPUT_PATH}`)
  console.log(`검수 후 'pnpm db:apply-industry-relevance'로 반영하세요.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
