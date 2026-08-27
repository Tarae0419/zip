"use client"

import type React from "react"
import Link from "next/link"
import { useState, useSyncExternalStore, useTransition } from "react"
import {
  AlertCircle,
  BrainCircuit,
  Building2,
  Car,
  ChevronDown,
  Clapperboard,
  Cpu,
  GraduationCap,
  HeartPulse,
  Info,
  Leaf,
  LineChart,
  Loader2,
  Sparkles,
  Truck,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCurriculumPlan } from "@/lib/actions/curriculum"
import type { CurriculumPlanResult, PlanItem, PlanItemType } from "@/lib/curriculum/types"

const iconMap: Record<string, LucideIcon> = {
  Cpu,
  BrainCircuit,
  HeartPulse,
  LineChart,
  Clapperboard,
  Leaf,
  Car,
  Building2,
  GraduationCap,
  Wheat,
  Truck,
}

const typeStyles: Record<PlanItemType, string> = {
  전공필수: "bg-primary/10 text-primary",
  복수전공필수: "bg-chart-3/15 text-chart-3",
  전공선택: "bg-chart-2/15 text-chart-2",
  관심분야: "bg-chart-4/15 text-chart-4",
}

type RequiredCourseOption = { code: string; name: string; credits: number }
type InterestField = { id: string; name: string; icon: string; description: string }
type SavedCurriculumPlan = {
  result: Extract<CurriculumPlanResult, { status: "ok" }>
  careerKeyword: string
}

const subscribeToClient = () => () => undefined

function readSavedCurriculumPlan(): SavedCurriculumPlan | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem("curriculum-plan-v2")
    if (!raw) return null
    const saved = JSON.parse(raw) as { result?: CurriculumPlanResult; careerKeyword?: string }
    if (
      saved.result?.status !== "ok" ||
      !Array.isArray(saved.result.semesters) ||
      !Array.isArray(saved.result.capabilityActivities)
    ) {
      return null
    }
    return {
      result: saved.result,
      careerKeyword: typeof saved.careerKeyword === "string" ? saved.careerKeyword : "",
    }
  } catch {
    window.localStorage.removeItem("curriculum-plan-v2")
    return null
  }
}

export function CurriculumPlanner({
  curriculumDepartments,
  allDepartments,
  requiredCoursesByDepartment,
  interestFields,
  myDepartment,
  curriculumMetadataByDepartment,
}: {
  curriculumDepartments: string[]
  allDepartments: string[]
  requiredCoursesByDepartment: Record<string, RequiredCourseOption[]>
  interestFields: InterestField[]
  myDepartment: string | null
  curriculumMetadataByDepartment: Record<string, { admissionYear: number; dataStatus: "illustrative" | "confirmed" }>
}) {
  const [savedPlan] = useState(readSavedCurriculumPlan)
  const isClient = useSyncExternalStore(subscribeToClient, () => true, () => false)
  const [isPending, startTransition] = useTransition()
  // 학과는 더 이상 직접 고르게 하지 않는다 — 회원가입 때 저장해둔 본인 학과를 그대로 쓴다.
  const department = myDepartment ?? ""
  const [doubleMajorDepartment, setDoubleMajorDepartment] = useState("")
  const [grade, setGrade] = useState(2)
  const [currentSemester, setCurrentSemester] = useState<1 | 2>(1)
  const [earnedCredits, setEarnedCredits] = useState("45")
  const [completedElectiveCredits, setCompletedElectiveCredits] = useState("0")
  const [remainingSemesters, setRemainingSemesters] = useState("5")
  const [completedCodes, setCompletedCodes] = useState<string[]>([])
  const [interestOrder, setInterestOrder] = useState<string[]>([])
  const [excludedCodes, setExcludedCodes] = useState<string[]>([])
  const [careerKeyword, setCareerKeyword] = useState(savedPlan?.careerKeyword ?? "")

  const [result, setResult] = useState<CurriculumPlanResult | null>(savedPlan?.result ?? null)
  const [activeTab, setActiveTab] = useState(0)
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(
    savedPlan ? "이 브라우저에 저장된 커리큘럼을 불러왔어요." : null,
  )
  const [feedback, setFeedback] = useState({ accuracy: 0, usefulness: 0, explainability: 0 })
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const requiredOptions = requiredCoursesByDepartment[department] ?? []
  const curriculumMetadata = curriculumMetadataByDepartment[department]
  // 복수전공/부전공은 커리큘럼 추천 계산이 없어도(getCurriculumForDepartment가 null이면 서버 액션이
  // 단일 전공 기준으로만 계산하고 안내 문구를 넣어준다) 선택 자체는 실제 학과 전체를 대상으로 허용한다.
  const otherDepartments = allDepartments.filter((d) => d !== department)

  function onlyDigits(value: string) {
    return value.replace(/[^0-9]/g, "")
  }

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
        currentSemester,
        earnedCredits: Number(earnedCredits) || 0,
        completedElectiveCredits: Number(completedElectiveCredits) || 0,
        completedRequiredCourseCodes: completedCodes,
        interestFieldIds: interestOrder,
        remainingSemesters: Number(remainingSemesters) || 1,
        excludedCourseCodes: nextExcluded,
        careerKeyword: careerKeyword.trim(),
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
      setError("학과 정보가 없어요. /fields에서 먼저 학과를 설정해주세요.")
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

  const visibleResult = isClient ? result : null
  const visibleCareerKeyword = isClient ? careerKeyword : ""
  const visibleSaveMessage = isClient ? saveMessage : null
  const activeSemester = visibleResult?.status === "ok" ? visibleResult.semesters[activeTab] : undefined

  const noDepartments = curriculumDepartments.length === 0

  function updateActivity(index: number, field: "title" | "reason", value: string) {
    setResult((current) => {
      if (!current || current.status !== "ok") return current
      return {
        ...current,
        capabilityActivities: current.capabilityActivities.map((activity, activityIndex) =>
          activityIndex === index ? { ...activity, [field]: value } : activity,
        ),
      }
    })
  }

  function removeActivity(index: number) {
    setResult((current) => {
      if (!current || current.status !== "ok") return current
      return { ...current, capabilityActivities: current.capabilityActivities.filter((_, activityIndex) => activityIndex !== index) }
    })
  }

  function savePlan() {
    if (!result || result.status !== "ok") return
    window.localStorage.setItem(
      "curriculum-plan-v2",
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), careerKeyword, result }),
    )
    setSaveMessage("수정한 커리큘럼을 이 브라우저에 저장했어요.")
  }

  function saveFeedback() {
    if (Object.values(feedback).some((score) => score < 1)) {
      setFeedbackMessage("세 항목을 모두 평가해주세요.")
      return
    }
    window.localStorage.setItem(
      "curriculum-feedback-v2",
      JSON.stringify({ version: 1, createdAt: new Date().toISOString(), ...feedback }),
    )
    setFeedbackMessage("평가를 저장했어요. 추천 품질 개선 기준으로 활용할게요.")
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-base font-bold text-foreground">내 정보 입력</h2>

        {noDepartments ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            아직 커리큘럼 데이터가 준비된 학과가 없어요.
          </p>
        ) : !myDepartment ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            학과 정보가 없어요.{" "}
            <Link href="/fields" className="font-medium text-primary underline underline-offset-2">
              여기서 먼저 학과를 설정해주세요.
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {/* 학과는 회원가입 때 저장한 본인 학과를 그대로 쓴다 — 다른 학과를 골라 계산할 이유가 없다. */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground">학과</span>
              <p className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">{department}</p>
              {curriculumMetadata ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{curriculumMetadata.admissionYear}학년도 교육과정 기준</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold",
                      curriculumMetadata.dataStatus === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {curriculumMetadata.dataStatus === "confirmed" ? "공식 자료 확인" : "참고용 데이터"}
                  </span>
                </div>
              ) : null}
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <Field label="현재 학년">
                <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="input">
                  {[1, 2, 3, 4].map((g) => (
                    <option key={g} value={g}>
                      {g}학년
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="현재 학기">
                <select value={currentSemester} onChange={(e) => setCurrentSemester(Number(e.target.value) as 1 | 2)} className="input">
                  <option value={1}>1학기</option>
                  <option value={2}>2학기</option>
                </select>
              </Field>
            </div>

            <Field label="기이수 학점">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={earnedCredits}
                onChange={(e) => setEarnedCredits(onlyDigits(e.target.value))}
                className="input"
              />
            </Field>

            <Field label="그중 전공선택으로 이미 인정된 학점">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={completedElectiveCredits}
                onChange={(e) => setCompletedElectiveCredits(onlyDigits(e.target.value))}
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
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={remainingSemesters}
                onChange={(e) => setRemainingSemesters(onlyDigits(e.target.value))}
                className="input"
              />
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

            <Field label="관심 직무·역량 키워드 (선택)">
              <input
                type="search"
                maxLength={80}
                value={visibleCareerKeyword}
                onChange={(event) => setCareerKeyword(event.target.value)}
                placeholder="예: 생성형 AI 서비스 기획, 데이터 분석"
                className="input"
              />
            </Field>
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
          disabled={isPending || noDepartments || !myDepartment}
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
        {!visibleResult && !isPending && <EmptyResult />}
        {isPending && !visibleResult && <LoadingResult />}

        {visibleResult?.status === "no_curriculum_data" && (
          <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-display font-semibold text-foreground">
              &apos;{visibleResult.department}&apos;의 커리큘럼 데이터가 아직 없어요
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              현재는 일부 학과만 지원돼요. 다른 학과를 선택해보세요.
            </p>
          </div>
        )}

        {visibleResult?.status === "ok" && activeSemester && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">추천 결과와 직접 수정한 활동을 브라우저에 보관할 수 있어요.</p>
              <button type="button" onClick={savePlan} className="rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
                현재 계획 저장
              </button>
              {visibleSaveMessage ? <p className="w-full text-xs text-primary" role="status">{visibleSaveMessage}</p> : null}
            </div>
            {visibleResult.notes.map((note, i) => (
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
              {visibleResult.semesters.map((sem, i) => (
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

            {visibleResult.capabilityActivities.length > 0 ? (
              <section className="mt-8">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">학년별 역량 활동</h2>
                    <p className="mt-1 text-sm text-muted-foreground">관심 분야와 키워드를 바탕으로 만든 비교과·프로젝트 제안이에요.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">공식 교내 프로그램이 아닌 AI 제안일 수 있어요.</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {visibleResult.capabilityActivities.map((activity, index) => (
                    <article key={`${activity.grade}-${activity.title}-${index}`} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{activity.grade}학년</span>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{activity.category}</span>
                        <span className="ml-auto text-xs text-muted-foreground">확신 {activity.confidence}</span>
                      </div>
                      <label className="mt-3 block">
                        <span className="sr-only">활동 제목 수정</span>
                        <input
                          value={activity.title}
                          maxLength={100}
                          onChange={(event) => updateActivity(index, "title", event.target.value)}
                          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display font-bold text-foreground outline-none transition hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/25"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="sr-only">추천 이유 수정</span>
                        <textarea
                          value={activity.reason}
                          maxLength={400}
                          rows={3}
                          onChange={(event) => updateActivity(index, "reason", event.target.value)}
                          className="w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-muted-foreground outline-none transition hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/25"
                        />
                      </label>
                      <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                        <div>
                          <dt className="font-semibold text-foreground">기대 역량</dt>
                          <dd className="mt-0.5 text-muted-foreground">{activity.expectedCapability}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-foreground">추천 근거</dt>
                          <dd className="mt-0.5 text-muted-foreground">{activity.evidenceBasis}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-primary">{activity.sourceType} · 사용자 수정 가능</p>
                        <button type="button" onClick={() => removeActivity(index)} className="text-xs font-medium text-destructive hover:underline">활동 삭제</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold text-foreground">추천 만족도</h2>
              <p className="mt-1 text-sm text-muted-foreground">각 항목을 1점부터 5점까지 평가해주세요.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {([
                  ["accuracy", "정확성"],
                  ["usefulness", "유용성"],
                  ["explainability", "설명 가능성"],
                ] as const).map(([key, label]) => (
                  <fieldset key={key}>
                    <legend className="text-sm font-semibold text-foreground">{label}</legend>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          aria-label={`${label} ${score}점`}
                          aria-pressed={feedback[key] === score}
                          onClick={() => setFeedback((current) => ({ ...current, [key]: score }))}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full border text-xs font-bold transition",
                            feedback[key] === score ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <button type="button" onClick={saveFeedback} className="mt-5 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10">
                평가 저장
              </button>
              {feedbackMessage ? <p className="mt-3 text-sm text-muted-foreground" role="status">{feedbackMessage}</p> : null}
            </section>
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
      {isOpen && item.prerequisiteCodes.length > 0 ? (
        <div className="border-t border-border px-4 py-3 text-sm">
          <p className="font-medium text-foreground">선수과목</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.prerequisiteCodes.map((code) => (
              <span key={code} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {code}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">이 과목보다 앞선 학기에 이수하도록 자동 검증된 항목입니다.</p>
        </div>
      ) : null}
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
