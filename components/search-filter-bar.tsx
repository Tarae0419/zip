"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

export type SortKey = "relevance" | "rating" | "reviews"

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "관련도순" },
  { key: "rating", label: "평점순" },
  { key: "reviews", label: "리뷰많은순" },
]

const creditOptions = ["전체", "1", "2", "3", "4"]
const gradeOptions = ["전체", "1", "2", "3", "4"]
const requirementOptions = ["전체", "전공필수", "전공선택", "기초필수", "계열공통", "교양"]

// 검색 필터/정렬은 URL 쿼리스트링에 반영한다 — 서버 컴포넌트(search-results.tsx)가
// searchParams를 읽어 실제 DB 쿼리 조건으로 사용하므로, 이 컴포넌트는 상태를 들고 있지 않고
// 링크 이동(router.replace)만 담당한다.
export function SearchFilterBar({
  sort,
  credit,
  grade,
  requirement,
}: {
  sort: SortKey
  credit: string
  grade: string
  requirement: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "전체") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
        필터
      </span>
      <FilterSelect
        label="학점"
        value={credit}
        onChange={(v) => updateParam("credit", v)}
        options={creditOptions}
        formatOption={(o) => (o === "전체" ? o : `${o}학점`)}
      />
      <FilterSelect
        label="학년"
        value={grade}
        onChange={(v) => updateParam("grade", v)}
        options={gradeOptions}
        formatOption={(o) => (o === "전체" ? o : `${o}학년`)}
      />
      <FilterSelect
        label="이수구분"
        value={requirement}
        onChange={(v) => updateParam("requirement", v)}
        options={requirementOptions}
      />

      <div className="ml-auto flex items-center gap-1 rounded-full bg-secondary p-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => updateParam("sort", opt.key === "relevance" ? "전체" : opt.key)}
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
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  formatOption = (o) => o,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  formatOption?: (option: string) => string
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {formatOption(opt)}
          </option>
        ))}
      </select>
    </label>
  )
}
