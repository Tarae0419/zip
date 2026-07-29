"use client"

import { useState } from "react"
import type { Course } from "@/lib/types"
import { CourseCard } from "@/components/course-card"
import { SearchTabs, type SearchTab } from "@/components/search-tabs"

// 탭 전환은 서버에 이미 받아온 두 결과(nameMatches/fieldMatches) 사이를 왔다갔다 하는 것뿐이라
// 클라이언트 상태만으로 처리한다 — router.replace로 서버를 다시 타면 매번 DB를 재조회하게 되어 느려진다.
export function SearchResultsView({
  initialTab,
  nameMatches,
  fieldMatches,
  fieldLabel,
}: {
  initialTab: SearchTab
  nameMatches: Course[]
  fieldMatches: Course[]
  fieldLabel: string
}) {
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)

  function handleSelect(tab: SearchTab) {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", tab)
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`)
  }

  const activeCourses = activeTab === "name" ? nameMatches : fieldMatches

  return (
    <>
      <SearchTabs
        active={activeTab}
        onSelect={handleSelect}
        nameCount={nameMatches.length}
        fieldCount={fieldMatches.length}
        fieldLabel={fieldLabel}
      />

      {activeCourses.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {activeTab === "name" ? "과목명이 일치하는 결과가 없어요." : "분야가 일치하는 결과가 없어요."} 다른 탭을 확인해보세요.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </>
  )
}
