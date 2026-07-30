"use client"

import type React from "react"
import { useMemo, useState, useTransition } from "react"
import {
  AlertCircle,
  BrainCircuit,
  ChevronDown,
  Clapperboard,
  Cpu,
  HeartPulse,
  Info,
  Leaf,
  LineChart,
  Loader2,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCurriculumPlan } from "@/lib/actions/curriculum"
import type { CurriculumPlanResult, PlanItem, PlanItemType } from "@/lib/curriculum/types"

const iconMap: Record<string, LucideIcon> = { Cpu, BrainCircuit, HeartPulse, LineChart, Clapperboard, Leaf }

const typeStyles: Record<PlanItemType, string> = {
  전공필수: "bg-primary/10 text-primary",
  복수전공필수: "bg-chart-3/15 text-chart-3",
  전공선택: "bg-chart-2/15 text-chart-2",
  관심분야: "bg-chart-4/15 text-chart-4",
}

type RequiredCourseOption = { code: string; name: string; credits: number }
type InterestField = { id: string; name: string; icon: string; description: string }

export function CurriculumPlanner({
  curriculumDepartments,
  allDepartments,
  requiredCoursesByDepartment,
  interestFields,
  myDepartment,
}: {
  curriculumDepartments: string[]
  allDepartments: string[]
  requiredCoursesByDepartment: Record<string, RequiredCourseOption[]>
  interestFields: InterestField[]
  myDepartment: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [department, setDepartment] = useState(
    myDepartment && curriculumDepartments.includes(myDepartment) ? myDepartment : curriculumDepartments[0] ?? "",
  )
  const [doubleMajorDepartment, setDoubleMajorDepartment] = useState("")
  const [grade, setGrade] = useState(2)
  const [earnedCredits, setEarnedCredits] = useState(45)
  const [completedElectiveCredits, setCompletedElectiveCredits] = useState(0)
  const [remainingSemesters, setRemainingSemesters] = useState(5)
  const [completedCodes, setCompletedCodes] = useState<string[]>([])
  const [interestOrder, setInterestOrder] = useState<string[]>([])
  const [excludedCodes, setExcludedCodes] = useState<string[]>([])

  const [result, setResult] = useState<CurriculumPlanResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requiredOptions = requiredCoursesByDepartment[department] ?? []
  // 복수전공/부전공은 커리큘럼 추천 계산이 없어도(getCurriculumForDepartment가 null이면 서버 액션이
  // 단일 전공 기준으로만 계산하고 안내 문구를 넣어준다) 선택 자체는 실제 학과 전체를 대상으로 허용한다.
  const otherDepartments = allDepartments.filter((d) => d !== department)

  function toggleCompleted(code: string) {
    setCompletedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function toggleInterest(id: string) {
    setInterestOrder((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  function runGenerate(nextExcluded: string[]) {
    setError(null)
    startTransition(async () => {
      const planResult = await generateCurriculumPlan({
        department,
        doubleMajorDepartment: doubleMajorDepartment || null,
        grade,
        earnedCredits,
        completedElectiveCredits,
        completedRequiredCourseCodes: completedCodes,
        interestFieldIds: interestOrder,
        remainingSemesters,
        excludedCourseCodes: nextExcluded,
      })
      setResult(planResult)
      setActiveTab(0)
      if (planResult.status === "ok" && planResult.semesters.every((s) => s.items.length === 0)) {
        setError(null)
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!department) {
      setError("학과를 선택해주세요.")
      return
    }
    setExcludedCodes([])
    runGenerate([])
  }

  function handleExclude(courseCode: string) {
    const next = [...excludedCodes, courseCode]
    setExcludedCodes(next)
    runGenerate(next)
  }

  function handleResetExclusions() {
    setExcludedCodes([])
    runGenerate([])
  }

  const activeSemester = result?.status === "ok" ? result.semesters[activeTab] : undefined

  const noDepartments = curriculumDepartments.length === 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-base font-bold text-foreground">내 정보 입력</h2>

        {noDepartments ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            아직 커리큘럼 데이터가 준비된 학과가 없어요.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="학과">
              <select value={department} onChange={(e) => { setDepartment(e.target.value); setCompletedCodes([]) }} className="input">
                {curriculumDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="복수전공/부전공 (선택)">
              <select value={doubleMajorDepartment} onChange={(e) => setDoubleMajorDepartment(e.target.value)} className="input">
                <option value="">선택 안 함</option>
                {otherDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="현재 학년">
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="input">
                {[1, 2, 3, 4].map((g) => (
                  <option key={g} value={g}>
                    {g}학년
                  </option>
                ))}
              </select>
            </Field>

            <Field label="기이수 학점">
              <input type="number" min={0} value={earnedCredits} onChange={(e) => setEarnedCredits(Number(e.target.value))} className="input" />
            </Field>

            <Field label="그중 전공선택으로 이미 인정된 학점">
              <input
                type="number"
                min={0}
                value={completedElectiveCredits}
                onChange={(e) => setCompletedElectiveCredits(Number(e.target.value))}
                className="input"
              />
            </Field>

            {requiredOptions.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">이미 이수한 전공필수 과목</p>
                <div className="space-y-1.5">
                  {requiredOptions.map((c) => (
                    <label key={c.code} className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={completedCodes.includes(c.code)} onChange={() => toggleCompleted(c.code)} />
                      {c.name} ({c.credits}학점)
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Field label="졸업까지 남은 학기 수">
              <input type="number" min={1} max={12} value={remainingSemesters} onChange={(e) => setRemainingSemesters(Number(e.target.value))} className="input" />
            </Field>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">관심 분야 (클릭 순서 = 우선순위)</p>
              <div className="flex flex-wrap gap-2">
                {interestFields.map((field) => {
                  const priority = interestOrder.indexOf(field.id)
                  const selected = priority !== -1
                  const Icon = iconMap[field.icon] ?? Sparkles
                  return (
                    <button
                      key={field.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleInterest(field.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {selected ? `${priority + 1}. ` : ""}
                      {field.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || noDepartments}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              추천 생성 중…
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
        {!result && !isPending && <EmptyResult />}
        {isPending && !result && <LoadingResult />}

        {result?.status === "no_curriculum_data" && (
          <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-display font-semibold text-foreground">
              &apos;{result.department}&apos;의 커리큘럼 데이터가 아직 없어요
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              현재는 일부 학과만 지원돼요. 다른 학과를 선택해보세요.
            </p>
          </div>
        )}

        {result?.status === "ok" && activeSemester && (
          <div>
            {result.notes.map((note, i) => (
              <div key={i} className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-accent/50 p-3.5 text-sm text-accent-foreground first:mt-0">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{note}</p>
              </div>
            ))}

            {excludedCodes.length > 0 && (
              <button
                type="button"
                onClick={handleResetExclusions}
                disabled={isPending}
                className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline disabled:opacity-50"
              >
                제외한 과목 {excludedCodes.length}개 되돌리기
              </button>
            )}

            {/* 학기 탭 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {result.semesters.map((sem, i) => (
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
                  {sem.label} · {sem.totalCredits}학점
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              <p className="text-sm text-muted-foreground">
                {activeSemester.label} 추천 과목 · 총 {activeSemester.totalCredits}학점
              </p>
              {activeSemester.items.map((item) => (
                <PlanItemRow
                  key={item.courseCode}
                  item={item}
                  isOpen={openItem === item.courseCode}
                  onToggleOpen={() => setOpenItem(openItem === item.courseCode ? null : item.courseCode)}
                  onExclude={() => handleExclude(item.courseCode)}
                  disabled={isPending}
                />
              ))}
              {activeSemester.items.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  이 학기에 추천할 과목이 없어요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PlanItemRow({
  item,
  isOpen,
  onToggleOpen,
  onExclude,
  disabled,
}: {
  item: PlanItem
  isOpen: boolean
  onToggleOpen: () => void
  onExclude: () => void
  disabled: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <button type="button" onClick={onToggleOpen} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", typeStyles[item.type])}>{item.type}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.name}</span>
          <span className="shrink-0 text-sm text-muted-foreground">{item.credits}학점</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180 text-primary")} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`${item.name} 제외`}
          disabled={disabled}
          onClick={onExclude}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
      {isOpen && <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">{item.reason}</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
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
      <p className="mt-4 font-display font-semibold text-foreground">정보를 입력하고 추천을 받아보세요</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">학과와 관심 분야를 바탕으로 학기별 추천 커리큘럼을 설계해드려요.</p>
    </div>
  )
}

function LoadingResult() {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 font-medium text-foreground">AI가 맞춤 커리큘럼을 설계하고 있어요…</p>
      <p className="mt-1 text-sm text-muted-foreground">잠시만 기다려주세요.</p>
    </div>
  )
}
