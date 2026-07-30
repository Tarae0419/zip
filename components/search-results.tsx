import { SearchX } from "lucide-react"
import type { Course } from "@/lib/types"
import { getDistinctSemesters, searchCoursesByFieldTag, searchCoursesByName, getUserDepartment, type SearchFilters } from "@/lib/db/queries"
import { getAnonId } from "@/lib/auth/anon-user"
import { SearchFilterBar } from "@/components/search-filter-bar"
import { SearchResultsView } from "@/components/search-results-view"
import type { SearchTab } from "@/components/search-tabs"

export async function SearchResults({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; credit?: string; grade?: string; requirement?: string; semester?: string; tab?: string }
}) {
  const query = (searchParams.q ?? "").trim()
  const credit = searchParams.credit ?? "전체"
  const grade = searchParams.grade ?? "전체"
  const requirement = searchParams.requirement ?? "전체"
  const semester = searchParams.semester ?? "전체"

  const filters: SearchFilters = {
    credits: credit !== "전체" ? Number(credit) : undefined,
    grade: grade !== "전체" ? Number(grade) : undefined,
    requirementType: requirement !== "전체" ? requirement : undefined,
    semester: semester !== "전체" ? semester : undefined,
  }

  // 이름 매칭과 분야 매칭은 서로 독립적으로 조회할 수 있다 — 분야 쪽은 일단 제외 없이 받아온 뒤
  // 이름 매칭 결과와 겹치는 것만 자바스크립트에서 걸러낸다. 두 조회를 순서대로(await 후 await) 하면
  // Neon 서버리스 드라이버 특성상 왕복이 두 번 직렬로 쌓여 느려지므로 Promise.all로 동시에 보낸다.
  const anonId = await getAnonId()
  const [{ view: nameMatches }, fieldMatchesRaw, availableSemesters, myDepartment] = await Promise.all([
    query ? searchCoursesByName(query, filters) : Promise.resolve({ view: [] as Course[], rows: [] }),
    query ? searchCoursesByFieldTag(query, [], filters) : Promise.resolve([] as Course[]),
    getDistinctSemesters(),
    getUserDepartment(anonId),
  ])

  const nameIds = new Set(nameMatches.map((c) => c.id))
  const fieldMatches = fieldMatchesRaw.filter((c) => !nameIds.has(c.id))
  const hasResults = nameMatches.length + fieldMatches.length > 0

  // 명시적으로 tab 파라미터가 있으면 그걸 따르고, 없으면 결과가 있는 쪽을 기본으로 보여준다.
  const requestedTab = searchParams.tab === "field" || searchParams.tab === "name" ? searchParams.tab : null
  const initialTab: SearchTab = requestedTab ?? (nameMatches.length > 0 || fieldMatches.length === 0 ? "name" : "field")

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">검색 결과</p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          &quot;{query}&quot;
          <span className="ml-2 text-base font-normal text-muted-foreground">
            총 {nameMatches.length + fieldMatches.length}개 과목
          </span>
        </h1>
      </div>

      <SearchFilterBar
        credit={credit}
        grade={grade}
        requirement={requirement}
        semester={semester}
        availableSemesters={availableSemesters}
      />

      {!hasResults ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-medium text-foreground">검색 결과가 없어요</p>
          <p className="text-sm text-muted-foreground">
            다른 과목명이나 분야 키워드로 검색해보세요.
          </p>
        </div>
      ) : (
        <SearchResultsView
          initialTab={initialTab}
          nameMatches={nameMatches}
          fieldMatches={fieldMatches}
          fieldLabel={query}
          viewerDepartment={myDepartment}
        />
      )}
    </div>
  )
}
