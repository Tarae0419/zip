"use client"

import { useMemo, useState } from "react"
import type { Course } from "@/lib/types"
import { CourseCard } from "@/components/course-card"
import { SearchTabs, type SearchTab } from "@/components/search-tabs"

type SortKey = "relevance" | "rating" | "reviews"

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "관련도순" },
  { key: "rating", label: "평점순" },
  { key: "reviews", label: "리뷰많은순" },
]

function sortCourses(list: Course[], sort: SortKey): Course[] {
  if (sort === "relevance") return list
  const copy = [...list]
  if (sort === "rating") copy.sort((a, b) => b.rating - a.rating)
  if (sort === "reviews") copy.sort((a, b) => b.reviewCount - a.reviewCount)
  return copy
}

// 탭 전환과 정렬 모두 서버에 이미 받아온 결과(nameMatches/fieldMatches)를 다루는 것뿐이라
// 클라이언트 상태만으로 처리한다 — router.replace로 서버를 다시 타면 정렬 버튼을 누를 때마다
// DB를 처음부터 재조회하게 되어 (원래는 즉시 재정렬이면 충분한데) 눈에 띄게 느려진다.
export function SearchResultsView({
  initialTab,
  nameMatches,
  fieldMatches,
  fieldLabel,
  viewerDepartment,
}: {
  initialTab: SearchTab
  nameMatches: Course[]
  fieldMatches: Course[]
  fieldLabel: string
  viewerDepartment: string | null
}) {
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)
  const [sort, setSort] = useState<SortKey>("relevance")

  function handleSelect(tab: SearchTab) {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", tab)
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
  }

  const activeCourses = activeTab === "name" ? nameMatches : fieldMatches
  const sortedCourses = useMemo(() => sortCourses(activeCourses, sort), [activeCourses, sort])

  return (
    <>
      <SearchTabs
        active={activeTab}
        onSelect={handleSelect}
        nameCount={nameMatches.length}
        fieldCount={fieldMatches.length}
        fieldLabel={fieldLabel}
      />

      <div className="mt-3 flex justify-end">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={sort === opt.key}
              onClick={() => setSort(opt.key)}
              className={
                sort === opt.key
                  ? "rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-primary shadow-sm"
                  : "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sortedCourses.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {activeTab === "name" ? "과목명이 일치하는 결과가 없어요." : "분야가 일치하는 결과가 없어요."} 다른 탭을 확인해보세요.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedCourses.map((course) => (
            <CourseCard key={course.id} course={course} viewerDepartment={viewerDepartment} />
          ))}
        </div>
      )}
    </>
  )
}
