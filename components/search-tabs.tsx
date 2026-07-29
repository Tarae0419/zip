"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

export type SearchTab = "name" | "field"

export function SearchTabs({
  active,
  nameCount,
  fieldCount,
  fieldLabel,
}: {
  active: SearchTab
  nameCount: number
  fieldCount: number
  fieldLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function switchTo(tab: SearchTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

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
          onClick={() => switchTo(tab.key)}
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
