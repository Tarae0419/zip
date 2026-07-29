"use client"

import { useRouter } from "next/navigation"
import { CalendarRange } from "lucide-react"
import { useCart } from "@/components/cart-provider"

function groupByYear(semesters: string[]): { year: string; terms: { value: string; term: string }[] }[] {
  const byYear = new Map<string, { value: string; term: string }[]>()
  for (const semester of semesters) {
    const match = semester.match(/^(\d{4})-(\d)$/)
    const year = match ? match[1] : semester
    const term = match ? match[2] : "-"
    const list = byYear.get(year) ?? []
    list.push({ value: semester, term })
    byYear.set(year, list)
  }
  return [...byYear.entries()]
    .map(([year, terms]) => ({ year, terms: terms.sort((a, b) => a.term.localeCompare(b.term)) }))
    .sort((a, b) => b.year.localeCompare(a.year))
}

export function SemesterPicker({ availableSemesters }: { availableSemesters: string[] }) {
  const router = useRouter()
  const { setSelectedSemester } = useCart()
  const grouped = groupByYear(availableSemesters)

  function handlePick(semester: string) {
    setSelectedSemester(semester)
    router.push(`/cart/courses?semester=${encodeURIComponent(semester)}`)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarRange className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-center font-display text-lg font-bold text-foreground">
        몇 년도, 몇 학기 시간표를 만들까요?
      </h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        선택한 학기에 개설된 과목만 다음 화면에서 골라 담을 수 있어요.
      </p>

      <div className="mx-auto mt-6 max-w-sm space-y-4">
        {grouped.map(({ year, terms }) => (
          <div key={year}>
            <p className="text-sm font-semibold text-foreground">{year}학년도</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {terms.map(({ value, term }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePick(value)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                >
                  {term}학기
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
