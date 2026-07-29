"use client"

import { cn } from "@/lib/utils"

export type SearchTab = "name" | "field"

// 순수 표시용 컴포넌트 — 네비게이션은 하지 않는다. 부모(search-results-view.tsx)가 상태를 들고
// 있다가 onSelect로 전달받아 즉시 전환한다(서버 재조회 없음 — 두 결과는 이미 다 받아온 상태).
export function SearchTabs({
  active,
  onSelect,
  nameCount,
  fieldCount,
  fieldLabel,
}: {
  active: SearchTab
  onSelect: (tab: SearchTab) => void
  nameCount: number
  fieldCount: number
  fieldLabel: string
}) {
  const tabs: { key: SearchTab; label: string; count: number }[] = [
    { key: "name", label: "과목명 일치", count: nameCount },
    { key: "field", label: `분야 일치: ${fieldLabel}`, count: fieldCount },
  ]

  return (
    <div role="tablist" aria-label="검색 결과 보기" className="mt-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onSelect(tab.key)}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
            active === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-xs font-semibold",
              active === tab.key ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
            )}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  )
}
