import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { curricula } from "@/lib/db/schema"
import { CurriculumForm } from "@/components/admin/curriculum-form"

export default async function EditCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row] = await db.select().from(curricula).where(eq(curricula.id, id)).limit(1)
  if (!row) notFound()

  return (
    <div>
      <Link href="/admin/curricula" className="text-sm text-muted-foreground hover:text-foreground">
        ← 커리큘럼 목록
      </Link>
      <h1 className="mt-2 font-display text-xl font-bold text-foreground">
        {row.department} {row.admissionYear}학번 수정
      </h1>
      <div className="mt-5 max-w-xl rounded-2xl border border-border bg-card p-5">
        <CurriculumForm
          initial={{
            id: row.id,
            department: row.department,
            admissionYear: row.admissionYear,
            requiredCourseCodes: (row.requiredCourseCodes as string[]) ?? [],
            electiveMinCredits: row.electiveMinCredits,
            generalEducationRequirement: (row.generalEducationRequirement as Record<string, number>) ?? {},
            totalCreditsRequired: row.totalCreditsRequired,
            dataStatus: row.dataStatus,
          }}
        />
      </div>
    </div>
  )
}
