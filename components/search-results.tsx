import { SearchX } from "lucide-react"
import type { Course } from "@/lib/types"
import { searchCoursesByFieldTag, searchCoursesByName, type SearchFilters } from "@/lib/db/queries"
import { SearchFilterBar, type SortKey } from "@/components/search-filter-bar"
import { SearchResultsView } from "@/components/search-results-view"
import type { SearchTab } from "@/components/search-tabs"

function sortCourses(list: Course[], sort: SortKey): Course[] {
  const copy = [...list]
  if (sort === "rating") copy.sort((a, b) => b.rating - a.rating)
  if (sort === "reviews") copy.sort((a, b) => b.reviewCount - a.reviewCount)
  return copy
}

export async function SearchResults({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; credit?: string; grade?: string; requirement?: string; tab?: string }
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

  // 이름 매칭과 분야 매칭은 서로 독립적으로 조회할 수 있다 — 분야 쪽은 일단 제외 없이 받아온 뒤
  // 이름 매칭 결과와 겹치는 것만 자바스크립트에서 걸러낸다. 두 조회를 순서대로(await 후 await) 하면
  // Neon 서버리스 드라이버 특성상 왕복이 두 번 직렬로 쌓여 느려지므로 Promise.all로 동시에 보낸다.
  const [{ view: nameMatches }, fieldMatchesRaw] = query
    ? await Promise.all([searchCoursesByName(query, filters), searchCoursesByFieldTag(query, [], filters)])
    : [{ view: [] as Course[] }, [] as Course[]]

  const nameIds = new Set(nameMatches.map((c) => c.id))
  const fieldMatches = fieldMatchesRaw.filter((c) => !nameIds.has(c.id))

  const sortedName = sortCourses(nameMatches, sort)
  const sortedField = sortCourses(fieldMatches, sort)
  const hasResults = sortedName.length + sortedField.length > 0

  // 명시적으로 tab 파라미터가 있으면 그걸 따르고, 없으면 결과가 있는 쪽을 기본으로 보여준다.
  const requestedTab = searchParams.tab === "field" || searchParams.tab === "name" ? searchParams.tab : null
  const initialTab: SearchTab = requestedTab ?? (sortedName.length > 0 || sortedField.length === 0 ? "name" : "field")

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
        <SearchResultsView initialTab={initialTab} nameMatches={sortedName} fieldMatches={sortedField} fieldLabel={query} />
      )}
    </div>
  )
}
