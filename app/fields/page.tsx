import { AppHeader } from "@/components/app-header"
import { FieldsExplorer, type FieldWithCourses } from "@/components/fields-explorer"
import { getAnonId } from "@/lib/auth/anon-user"
import { getIndustryFieldCourses, getIndustryFields, getUserDepartment } from "@/lib/db/queries"

export default async function FieldsPage() {
  const anonId = await getAnonId()

  const [fieldSummaries, myDepartment] = await Promise.all([getIndustryFields(), getUserDepartment(anonId)])

  const fields: FieldWithCourses[] = await Promise.all(
    fieldSummaries.map(async (field) => ({
      ...field,
      courses: await getIndustryFieldCourses(field.id, 12),
    })),
  )

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            분야로 찾기
          </h1>
          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            관심 있는 산업·진로 분야를 선택하면, 전공을 넘나들며 연관도가 높은
            과목을 추천해드려요.
          </p>
        </div>

        <div className="mt-8">
          <FieldsExplorer fields={fields} myDepartment={myDepartment} />
        </div>
      </main>
    </div>
  )
}
