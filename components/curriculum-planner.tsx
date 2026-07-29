"use client"

import type React from "react"
import { useMemo, useState } from "react"
import {
  ChevronDown,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  departments,
  interestFields,
  mockCurriculum,
  type CurriculumItem,
} from "@/lib/mock-data"

type Status = "idle" | "loading" | "done"

const typeStyles: Record<CurriculumItem["type"], string> = {
  전공필수: "bg-primary/10 text-primary",
  전공선택: "bg-chart-2/15 text-chart-2",
  관심분야: "bg-chart-4/15 text-chart-4",
}

export function CurriculumPlanner() {
  const [department, setDepartment] = useState(departments[0])
  const [grade, setGrade] = useState("2학년 1학기")
  const [earnedCredits, setEarnedCredits] = useState(45)
  const [fields, setFields] = useState<string[]>(["반도체"])
  const [remainingSemesters, setRemainingSemesters] = useState(5)

  const [status, setStatus] = useState<Status>("idle")
  const [activeTab, setActiveTab] = useState(0)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [openItem, setOpenItem] = useState<string | null>(null)

  function toggleField(field: string) {
    setFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    )
  }

  function handleRecommend() {
    setStatus("loading")
    // 실제 지연/로직 없이 UI만 흉내
    setTimeout(() => {
      setStatus("done")
      setActiveTab(0)
      setRemoved(new Set())
    }, 1200)
  }

  const activeSemester = mockCurriculum[activeTab]
  const visibleItems = useMemo(
    () => activeSemester.items.filter((item) => !removed.has(itemKey(activeTab, item))),
    [activeSemester, removed, activeTab],
  )
  const visibleCredits = visibleItems.reduce((sum, item) => sum + item.credits, 0)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* 입력 폼 */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleRecommend()
        }}
        className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24"
      >
        <h2 className="font-display text-base font-bold text-foreground">
          내 정보 입력
        </h2>

        <div className="mt-4 space-y-4">
          <Field label="학과">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="input"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <Field label="현재 학년/학기">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="input"
            >
              {["1학년 1학기", "1학년 2학기", "2학년 1학기", "2학년 2학기", "3학년 1학기", "3학년 2학기"].map(
                (g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="기이수 학점">
            <input
              type="number"
              min={0}
              value={earnedCredits}
              onChange={(e) => setEarnedCredits(Number(e.target.value))}
              className="input"
            />
          </Field>

          <Field label="졸업까지 남은 학기 수">
            <input
              type="number"
              min={1}
              value={remainingSemesters}
              onChange={(e) => setRemainingSemesters(Number(e.target.value))}
              className="input"
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">관심 분야</p>
            <div className="flex flex-wrap gap-2">
              {interestFields.map((field) => {
                const selected = fields.includes(field)
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleField(field)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
                    )}
                  >
                    {field}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              추천 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden="true" />
              커리큘럼 추천받기
            </>
          )}
        </button>
      </form>

      {/* 결과 영역 */}
      <div>
        {status === "idle" && <EmptyResult />}
        {status === "loading" && <LoadingResult />}
        {status === "done" && (
          <div>
            <div className="flex items-start gap-2 rounded-xl border border-border bg-accent/50 p-3.5 text-sm text-accent-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>본 추천은 참고용이며, 최종 확인은 학과 사무실을 통해주세요.</p>
            </div>

            {/* 학기 탭 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {mockCurriculum.map((sem, i) => {
                const credits = sem.items
                  .filter((item) => !removed.has(itemKey(i, item)))
                  .reduce((s, item) => s + item.credits, 0)
                return (
                  <button
                    key={sem.label}
                    type="button"
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      activeTab === i
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary",
                    )}
                  >
                    {sem.label} · {credits}학점
                  </button>
                )
              })}
            </div>

            {/* 추천 과목 아코디언 */}
            <div className="mt-4 space-y-2.5">
              <p className="text-sm text-muted-foreground">
                {activeSemester.label} 추천 과목 · 총 {visibleCredits}학점
              </p>
              {visibleItems.map((item) => {
                const key = itemKey(activeTab, item)
                const isOpen = openItem === key
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => setOpenItem(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                            typeStyles[item.type],
                          )}
                        >
                          {item.type}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {item.credits}학점
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180 text-primary",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.name} 제외`}
                        onClick={() =>
                          setRemoved((prev) => new Set(prev).add(key))
                        }
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {isOpen && (
                      <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                        {item.reason}
                      </p>
                    )}
                  </div>
                )
              })}

              {visibleItems.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  이 학기의 추천 과목을 모두 제외했어요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function itemKey(tabIndex: number, item: CurriculumItem) {
  return `${tabIndex}-${item.name}`
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function EmptyResult() {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-display font-semibold text-foreground">
        정보를 입력하고 추천을 받아보세요
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        학과와 관심 분야를 바탕으로 학기별 추천 커리큘럼을 설계해드려요.
      </p>
    </div>
  )
}

function LoadingResult() {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 font-medium text-foreground">
        AI가 맞춤 커리큘럼을 설계하고 있어요...
      </p>
      <p className="mt-1 text-sm text-muted-foreground">잠시만 기다려주세요.</p>
    </div>
  )
}
