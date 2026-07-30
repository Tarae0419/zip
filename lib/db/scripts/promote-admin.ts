// 최초 관리자 계정 지정. 회원가입 화면에는 관리자 권한을 부여하는 경로가 없다(PRD 13.2) —
// 반드시 이 스크립트로 DB에 직접 지정한다. 이후 추가 관리자는 관리자 페이지(/admin/users)에서 지정 가능.
// 실행: pnpm db:promote-admin -- <학번>
import { eq } from "drizzle-orm"
import { db } from "../client"
import { users } from "../schema"

async function main() {
  const studentId = process.argv[2]
  if (!studentId) {
    console.error("사용법: pnpm db:promote-admin -- <학번>")
    process.exit(1)
  }

  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.studentId, studentId))
    .returning({ id: users.id, name: users.name, studentId: users.studentId })

  if (!updated) {
    console.error(`학번 ${studentId}로 가입된 계정을 찾을 수 없습니다.`)
    process.exit(1)
  }

  console.log(`관리자로 승격: ${updated.name ?? "(이름 없음)"} (${updated.studentId})`)
}

main().then(() => process.exit(0))
