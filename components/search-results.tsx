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

  // 이름 매칭과 분야 매칭은 서로 독립적으로 조회한다 — 분야 탭은 태그된 과목을 전부 보여주는 게
  // 목적이라, 이름에도 검색어가 포함된 과목(예: "반도체" 검색 시 "반도체소자" 같은 과목)이라도 걸러내지
  // 않는다(2026-08-01 변경 전에는 이름 탭과 겹치는 과목을 분야 탭에서 제외했는데, "반도체"처럼 학과가
  // 과목명에 검색어를 그대로 쓰는 분야는 태그된 과목 대부분이 이름 탭에도 잡혀서 분야 탭이 거의 비어
  // 보이는 문제가 있었다). 두 조회를 순서대로(await 후 await) 하면 Neon 서버리스 드라이버 특성상
  // 왕복이 두 번 직렬로 쌓여 느려지므로 Promise.all로 동시에 보낸다.
  const anonId = await getAnonId()
  const [{ view: nameMatches }, fieldMatches, availableSemesters, myDepartment] = await Promise.all([
    query ? searchCoursesByName(query, filters) : Promise.resolve({ view: [] as Course[], rows: [] }),
    query ? searchCoursesByFieldTag(query, [], filters) : Promise.resolve([] as Course[]),
    getDistinctSemesters(),
    getUserDepartment(anonId),
  ])

  // 헤더의 "총 N개 과목"은 두 탭에 겹쳐 나오는 과목을 중복 집계하지 않도록 고유 개수로 센다.
  const uniqueResultCount = new Set([...nameMatches, ...fieldMatches].map((c) => c.id)).size
  const hasResults = uniqueResultCount > 0

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
            총 {uniqueResultCount}개 과목
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
