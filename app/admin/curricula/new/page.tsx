import Link from "next/link"
import { CurriculumForm } from "@/components/admin/curriculum-form"

export default function NewCurriculumPage() {
  return (
    <div>
      <Link href="/admin/curricula" className="text-sm text-muted-foreground hover:text-foreground">
        ← 커리큘럼 목록
      </Link>
      <h1 className="mt-2 font-display text-xl font-bold text-foreground">새 커리큘럼 추가</h1>
      <div className="mt-5 max-w-xl rounded-2xl border border-border bg-card p-5">
        <CurriculumForm />
      </div>
    </div>
  )
}
