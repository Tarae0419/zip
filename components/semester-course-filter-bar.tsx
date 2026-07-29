"use client"

import { useState, type FormEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { formatSemesterLabel } from "@/lib/timetable/schedule"

export function SemesterCourseFilterBar({
  semester,
  availableSemesters,
  query,
  department,
  departments,
}: {
  semester: string
  availableSemesters: string[]
  query: string
  department: string
  departments: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [queryInput, setQueryInput] = useState(query)

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === "전체") params.delete(key)
    else params.set(key, value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateParam("q", queryInput.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">학년도</span>
        <select
          value={semester}
          onChange={(e) => updateParam("semester", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
        >
          {availableSemesters.map((s) => (
            <option key={s} value={s}>
              {formatSemesterLabel(s)}
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
        className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        검색
      </button>
    </form>
  )
}
