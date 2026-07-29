// score-industry-relevance.ts가 만든 검수 완료 JSON을 course_industry_tags에 반영한다.
// 임베딩은 대표(canonical) row 하나에만 있었으므로, 같은 과목의 다른 학기 row에도 동일하게 반영한다.
// 실행: pnpm db:apply-industry-relevance
import fs from "node:fs/promises"
import { eq, sql } from "drizzle-orm"
import { db } from "../client"
import { courseIndustryTags, courses, industryTags } from "../schema"
import { getSiblingCourseIds } from "../queries"

const INPUT_PATH = "lib/db/scripts/industry-relevance-result.json"

type RelevanceResult = { tagName: string; courseId: string; courseName: string; department: string; score: number }

async function main() {
  const raw = await fs.readFile(INPUT_PATH, "utf-8")
  const results = JSON.parse(raw) as RelevanceResult[]

  const tagRows = await db.select({ id: industryTags.id, name: industryTags.name }).from(industryTags)
  const tagIdByName = new Map(tagRows.map((t) => [t.name, t.id]))

  const rowsToInsert: (typeof courseIndustryTags.$inferInsert)[] = []
  let skippedUnknownTags = 0

  for (const result of results) {
    const tagId = tagIdByName.get(result.tagName)
    if (!tagId) {
      skippedUnknownTags++
      continue
    }
    const [canonical] = await db.select({ code: courses.code, name: courses.name }).from(courses).where(eq(courses.id, result.courseId)).limit(1)
    if (!canonical) continue

    const siblingIds = await getSiblingCourseIds(canonical)
    for (const courseId of siblingIds) {
      rowsToInsert.push({ courseId, industryTagId: tagId, relevanceScore: result.score })
    }
  }

  console.log(`삽입 예정: ${rowsToInsert.length}건 (연관도 결과 ${results.length}개, 미확인 태그 스킵 ${skippedUnknownTags}건)`)

  const BATCH_SIZE = 500
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
    await db
      .insert(courseIndustryTags)
      .values(batch)
      .onConflictDoUpdate({
        target: [courseIndustryTags.courseId, courseIndustryTags.industryTagId],
        set: { relevanceScore: sql`excluded.relevance_score` },
      })
    console.log(`  ${Math.min(i + BATCH_SIZE, rowsToInsert.length)}/${rowsToInsert.length}`)
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(courseIndustryTags)
  console.log(`\n적용 완료. course_industry_tags 총 ${count}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
