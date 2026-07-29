import { SearchX } from "lucide-react"
import type { Course } from "@/lib/types"
import { searchCoursesByFieldTag, searchCoursesByName, type SearchFilters } from "@/lib/db/queries"
import { CourseCard } from "@/components/course-card"
import { SearchFilterBar, type SortKey } from "@/components/search-filter-bar"

function sortCourses(list: Course[], sort: SortKey): Course[] {
  const copy = [...list]
  if (sort === "rating") copy.sort((a, b) => b.rating - a.rating)
  if (sort === "reviews") copy.sort((a, b) => b.reviewCount - a.reviewCount)
  return copy
}

export async function SearchResults({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; credit?: string; grade?: string; requirement?: string }
}) {
  const query = (searchParams.q ?? "").trim()
  const sort: SortKey = searchParams.sort === "rating" || searchParams.sort === "reviews" ? searchParams.sort : "relevance"
  const credit = searchParams.credit ?? "전체"
  const grade = searchParams.grade ?? "전체"
  const requirement = searchParams.requirement ?? "전체"

  const filters: SearchFilters = {
    credits: credit !== "전체" ? Number(credit) : undefined,
    grade: grade !== "전체" ? Number(grade) : undefined,
    requirementType: requirement !== "전체" ? requirement : undefined,
  }

  const { view: nameMatches } = query ? await searchCoursesByName(query, filters) : { view: [] as Course[] }
  const fieldMatches = query ? await searchCoursesByFieldTag(query, nameMatches.map((c) => c.id), filters) : []

  const sortedName = sortCourses(nameMatches, sort)
  const sortedField = sortCourses(fieldMatches, sort)
  const hasResults = sortedName.length + sortedField.length > 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">검색 결과</p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          &quot;{query}&quot;
          <span className="ml-2 text-base font-normal text-muted-foreground">
            총 {sortedName.length + sortedField.length}개 과목
          </span>
        </h1>
      </div>

      <SearchFilterBar sort={sort} credit={credit} grade={grade} requirement={requirement} />

      {!hasResults ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-medium text-foreground">검색 결과가 없어요</p>
          <p className="text-sm text-muted-foreground">
            다른 과목명이나 분야 키워드로 검색해보세요.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {sortedName.length > 0 && (
            <ResultSection title="과목명 일치" count={sortedName.length} courses={sortedName} />
          )}
          {sortedField.length > 0 && (
            <ResultSection title={`분야 일치: ${query}`} count={sortedField.length} courses={sortedField} />
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({
  title,
  count,
  courses,
}: {
  title: string
  count: number
  courses: Course[]
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  )
}
