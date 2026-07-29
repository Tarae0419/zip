"use client"

import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { SlidersHorizontal, SearchX } from "lucide-react"
import { mockCourses, type Course } from "@/lib/mock-data"
import { CourseCard } from "@/components/course-card"

type SortKey = "relevance" | "rating" | "reviews"

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "관련도순" },
  { key: "rating", label: "평점순" },
  { key: "reviews", label: "리뷰많은순" },
]

const creditOptions = ["전체", "1학점", "2학점", "3학점"]
const gradeOptions = ["전체", "1학년", "2학년", "3학년", "4학년"]
const requirementOptions = ["전체", "전공필수", "전공선택", "교양"]

function matchesField(course: Course, q: string): boolean {
  const haystack = [
    course.industry ?? "",
    course.academicField ?? "",
    ...course.hashtags.map((h) => h.tag),
    course.department,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function sortCourses(list: Course[], sort: SortKey): Course[] {
  const copy = [...list]
  if (sort === "rating") copy.sort((a, b) => b.rating - a.rating)
  if (sort === "reviews") copy.sort((a, b) => b.reviewCount - a.reviewCount)
  return copy
}

export function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") ?? ""

  const [sort, setSort] = useState<SortKey>("relevance")
  const [credit, setCredit] = useState("전체")
  const [grade, setGrade] = useState("전체")
  const [requirement, setRequirement] = useState("전체")

  const { nameMatches, fieldMatches, fieldLabel } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nameMatches = mockCourses.filter((c) =>
      c.name.toLowerCase().includes(q),
    )
    const nameIds = new Set(nameMatches.map((c) => c.id))
    const fieldMatches = mockCourses.filter(
      (c) => !nameIds.has(c.id) && matchesField(c, q),
    )
    return { nameMatches, fieldMatches, fieldLabel: query.trim() }
  }, [query])

  const sortedName = sortCourses(nameMatches, sort)
  const sortedField = sortCourses(fieldMatches, sort)
  const hasResults = sortedName.length + sortedField.length > 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">검색 결과</p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          &quot;{query}&quot;
          <span className="ml-2 text-base font-normal text-muted-foreground">
            총 {sortedName.length + sortedField.length}개 과목
          </span>
        </h1>
      </div>

      {/* 필터 & 정렬 */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
          필터
        </span>
        <FilterSelect label="학점" value={credit} onChange={setCredit} options={creditOptions} />
        <FilterSelect label="학년" value={grade} onChange={setGrade} options={gradeOptions} />
        <FilterSelect
          label="이수구분"
          value={requirement}
          onChange={setRequirement}
          options={requirementOptions}
        />

        <div className="ml-auto flex items-center gap-1 rounded-full bg-secondary p-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
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

      {!hasResults ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-medium text-foreground">검색 결과가 없어요</p>
          <p className="text-sm text-muted-foreground">
            다른 과목명이나 분야 키워드로 검색해보세요.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {sortedName.length > 0 && (
            <ResultSection title="과목명 일치" count={sortedName.length} courses={sortedName} />
          )}
          {sortedField.length > 0 && (
            <ResultSection
              title={`분야 일치: ${fieldLabel}`}
              count={sortedField.length}
              courses={sortedField}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({
  title,
  count,
  courses,
}: {
  title: string
  count: number
  courses: Course[]
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
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
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}
