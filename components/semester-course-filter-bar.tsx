"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const GRADE_OPTIONS = ["전체", "1", "2", "3", "4"]
const CATEGORY_OPTIONS = ["전체", "전공", "교양"]
const QUERY_DEBOUNCE_MS = 350

export function SemesterCourseFilterBar({
  query,
  department,
  departments,
  grade,
  category,
}: {
  query: string
  department: string
  departments: string[]
  grade: string
  category: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [queryInput, setQueryInput] = useState(query)
  // router.push는 기본적으로 화면을 블로킹하는 렌더처럼 느껴진다 — startTransition으로 감싸면
  // 드롭다운/입력은 바로 반응하고, 새 목록이 오는 동안 isPending으로 로딩 표시만 살짝 준다.
  const [isPending, startTransition] = useTransition()
  const isFirstRender = useRef(true)

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "전체") params.delete(key)
      else params.set(key, value)
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // 검색어는 버튼 클릭 없이 입력이 멈추면 자동으로 반영한다(다른 드롭다운들과 동일하게 즉시 반응하는
  // 느낌을 주기 위함 — 이전엔 "검색" 버튼을 따로 눌러야 했는데, 좁은 화면에서 버튼만 다음 줄로
  // 밀려 내려가 보여서 별도 제출 버튼 자체를 없앴다, 2026-08-01).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timer = setTimeout(() => updateParams({ q: queryInput.trim() }), QUERY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput])

  function handleCategoryChange(value: string) {
    // 교양은 학과별로 의미 있게 묶이지 않는다(교양 과목도 개설은 특정 학과가 하지만, 학생 입장에서는
    // "어느 학과가 개설했는지"가 중요하지 않다) — 교양으로 바꾸면 학과·학년 필터 자체를 숨기고,
    // 숨겨진 채로 예전 값이 조용히 계속 적용되는 걸 막기 위해 값도 함께 초기화한다.
    if (value === "교양") {
      updateParams({ category: value, department: "전체", grade: "전체" })
    } else {
      updateParams({ category: value })
    }
  }

  const showDepartmentAndGrade = category !== "교양"

  return (
    <div className={cn("flex flex-wrap items-center gap-3 transition-opacity", isPending && "opacity-60")}>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">구분</span>
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {showDepartmentAndGrade && (
        <>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">학과</span>
            <select
              value={department}
              onChange={(e) => updateParams({ department: e.target.value })}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            >
              <option value="전체">전체</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">학년</span>
            <select
              value={grade}
              onChange={(e) => updateParams({ grade: e.target.value })}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g === "전체" ? g : `${g}학년`}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="relative min-w-[200px] flex-1">
        {isPending ? (
          <Loader2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        )}
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="과목명으로 찾기 (선택)"
          aria-label="과목명 검색"
          className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-4 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
      </div>
    </div>
  )
}
