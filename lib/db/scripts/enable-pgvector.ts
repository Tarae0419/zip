// pgvector 확장 활성화 (F3 임베딩 기반 연관도 스코어링에 필요, PRD 10.3). 한 번만 실행하면 된다.
import { neon } from "@neondatabase/serverless"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  await sql`CREATE EXTENSION IF NOT EXISTS vector`
  const [{ extversion }] = (await sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`) as { extversion: string }[]
  console.log("pgvector extension enabled, version:", extversion)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
