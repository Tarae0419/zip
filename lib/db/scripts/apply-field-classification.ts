// classify-course-fields.ts가 만든 검수용 JSON을 course_field_tags에 반영한다.
// 실행: pnpm db:apply-field-classification
import fs from "node:fs/promises"
import { sql } from "drizzle-orm"
import { db } from "../client"
import { courseFieldTags, fieldTags } from "../schema"

const INPUT_PATH = "lib/db/scripts/field-classification-result.json"

type ClassificationResult = { key: string; name: string; courseIds: string[]; tags: string[] }

async function main() {
  const raw = await fs.readFile(INPUT_PATH, "utf-8")
  const results = JSON.parse(raw) as ClassificationResult[]

  const tagRows = await db.select({ id: fieldTags.id, name: fieldTags.name }).from(fieldTags)
  const tagIdByName = new Map(tagRows.map((t) => [t.name, t.id]))

  const rowsToInsert: (typeof courseFieldTags.$inferInsert)[] = []
  let skippedUnknownTags = 0

  for (const result of results) {
    for (const tagName of result.tags) {
      const tagId = tagIdByName.get(tagName)
      if (!tagId) {
        skippedUnknownTags++
        continue
      }
      for (const courseId of result.courseIds) {
        rowsToInsert.push({ courseId, fieldTagId: tagId })
      }
    }
  }

  console.log(`삽입 예정: ${rowsToInsert.length}건 (과목 ${results.length}개, 미확인 태그 스킵 ${skippedUnknownTags}건)`)

  const BATCH_SIZE = 500
  let inserted = 0
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
    await db.insert(courseFieldTags).values(batch).onConflictDoNothing()
    inserted += batch.length
    console.log(`  ${Math.min(inserted, rowsToInsert.length)}/${rowsToInsert.length}`)
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(courseFieldTags)
  console.log(`\n적용 완료. course_field_tags 총 ${count}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
