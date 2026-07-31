"use client"

import { useState, useTransition, type FormEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const GRADE_OPTIONS = ["전체", "1", "2", "3", "4"]
const CATEGORY_OPTIONS = ["전체", "전공", "교양"]

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

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === "전체") params.delete(key)
    else params.set(key, value)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateParam("q", queryInput.trim())
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-wrap items-center gap-3 transition-opacity", isPending && "opacity-60")}
    >
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">구분</span>
        <select
          value={category}
          onChange={(e) => updateParam("category", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">학과</span>
        <select
          value={department}
          onChange={(e) => updateParam("department", e.target.value)}
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
          onChange={(e) => updateParam("grade", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g === "전체" ? g : `${g}학년`}
            </option>
          ))}
        </select>
      </label>

      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="과목명으로 찾기 (선택)"
          aria-label="과목명 검색"
          className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-4 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait"
      >
        {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        검색
      </button>
    </form>
  )
}
