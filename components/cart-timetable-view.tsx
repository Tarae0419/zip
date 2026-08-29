"use client"

import { useMemo, useRef, useState, useTransition, type RefObject } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { CalendarDays, Info, Loader2, MapPin, Plus, ShoppingCart, Sparkles, Trash2, X } from "lucide-react"
import type { Course } from "@/lib/types"
import { useCart } from "@/components/cart-provider"
import { AddCourseModal } from "@/components/add-course-modal"
import { WeeklyTimetable } from "@/components/weekly-timetable"
import { CampusMap } from "@/components/campus-map"
import { WEEKDAYS } from "@/lib/timetable/types"
import type { CartCourse, Weekday } from "@/lib/timetable/types"
import { buildSessionsForCourse, formatMinutes, formatSemesterLabel, getSessionsForDay } from "@/lib/timetable/schedule"
import { evaluateSchedulePreferences } from "@/lib/timetable/preferences"
import type { TimePreference } from "@/lib/timetable/preferences"
import type { ScheduleCandidate } from "@/lib/timetable/preferences"
import { createPreferredScheduleCandidates } from "@/lib/actions/schedule-preferences"
import { cn } from "@/lib/utils"

export function CartTimetableView({
  availableSemesters,
  activeSemester,
  departments,
  department,
  grade,
  category,
  query,
  browsableCourses,
  browsableTotalCount,
  browsableTotalPages,
  page,
  viewerDepartment,
}: {
  availableSemesters: string[]
  activeSemester: string
  departments: string[]
  department: string
  grade: string
  category: string
  query: string
  browsableCourses: Course[]
  browsableTotalCount: number
  browsableTotalPages: number
  page: number
  viewerDepartment: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { cart, mounted, removeCourse, replaceSemesterCart } = useCart()
  const manageCourseTriggerRef = useRef<HTMLButtonElement>(null)
  const manageCourseFallbackRef = useRef<HTMLButtonElement>(null)
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null)
  const [managingCourseId, setManagingCourseId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [timePreference, setTimePreference] = useState<TimePreference>("any")
  const [preferredFreeDays, setPreferredFreeDays] = useState<Weekday[]>([])
  const [allowedStartHour, setAllowedStartHour] = useState("9")
  const [allowedEndHour, setAllowedEndHour] = useState("19")
  const [minCredits, setMinCredits] = useState("0")
  const [maxCredits, setMaxCredits] = useState("24")
  const [scheduleCandidates, setScheduleCandidates] = useState<ScheduleCandidate[]>([])
  const [candidateMessage, setCandidateMessage] = useState<string | null>(null)

  function handleSemesterChange(nextSemester: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("semester", nextSemester)
    params.delete("q")
    params.delete("department")
    params.delete("grade")
    params.delete("category")
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const scopedCart = useMemo(() => cart.filter((c) => c.semester === activeSemester), [cart, activeSemester])
  const otherSemesterItems = useMemo(() => cart.filter((c) => c.semester !== activeSemester), [cart, activeSemester])
  const displayedDay =
    selectedDay ??
    (mounted ? WEEKDAYS.find((day) => getSessionsForDay(scopedCart, day).length > 0) : undefined) ??
    "월"
  const totalCredits = scopedCart.reduce((sum, c) => sum + c.credits, 0)
  const managingCourse = scopedCart.find((c) => c.id === managingCourseId) ?? null
  // 시간표 그리드에 블록으로 안 뜨는(수업 시간 정보가 없는) 과목은 별도 목록으로 계속 보여준다 —
  // 안 그러면 관리(삭제)할 방법이 아예 없어진다.
  const noScheduleCourses = scopedCart.filter((c) => buildSessionsForCourse(c).length === 0)
  const preferenceEvaluation = useMemo(
    () => evaluateSchedulePreferences(scopedCart, {
      timePreference,
      preferredFreeDays,
      allowedStartMinutes: Number(allowedStartHour) * 60,
      allowedEndMinutes: Number(allowedEndHour) * 60,
      minCredits: Number(minCredits),
      maxCredits: Number(maxCredits),
    }),
    [scopedCart, timePreference, preferredFreeDays, allowedStartHour, allowedEndHour, minCredits, maxCredits],
  )

  function togglePreferredFreeDay(day: Weekday) {
    setPreferredFreeDays((current) =>
      current.includes(day) ? current.filter((candidate) => candidate !== day) : [...current, day],
    )
  }

  function handleGenerateCandidates() {
    setCandidateMessage(null)
    startTransition(async () => {
      try {
        const candidates = await createPreferredScheduleCandidates(activeSemester, {
          timePreference,
          preferredFreeDays,
          allowedStartMinutes: Number(allowedStartHour) * 60,
          allowedEndMinutes: Number(allowedEndHour) * 60,
          minCredits: Number(minCredits),
          maxCredits: Number(maxCredits),
        })
        setScheduleCandidates(candidates)
        if (candidates.length === 0) setCandidateMessage("현재 과목을 모두 유지하면서 만들 수 있는 충돌 없는 분반 조합이 없어요.")
      } catch {
        setCandidateMessage("시간표 후보를 만드는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.")
      }
    })
  }

  function handleApplyCandidate(candidate: ScheduleCandidate) {
    setCandidateMessage(null)
    startTransition(async () => {
      const ok = await replaceSemesterCart(activeSemester, candidate.courses)
      setCandidateMessage(ok ? "선택한 후보를 내 시간표에 적용했어요." : "후보를 적용하지 못했어요.")
      if (ok) setScheduleCandidates([])
    })
  }

  if (!activeSemester) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        아직 개설된 학기 데이터가 없어요.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <label className="flex items-center gap-1.5">
            <span className="sr-only">학년도 선택</span>
            <select
              value={activeSemester}
              onChange={(e) => handleSemesterChange(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1 font-display text-base font-bold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            >
              {availableSemesters.map((s) => (
                <option key={s} value={s}>
                  {formatSemesterLabel(s)}
                </option>
              ))}
            </select>
          </label>
          {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          <span className="font-display text-base font-bold text-foreground">시간표</span>
        </div>
        <button
          ref={manageCourseFallbackRef}
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden="true" />
          과목 추가
        </button>
      </div>

      {scopedCart.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingCart className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-foreground">
            {formatSemesterLabel(activeSemester)}에 담은 강의가 없어요
          </p>
          <p className="mt-1 text-sm text-muted-foreground">과목을 담으면 시간표와 이동동선을 확인할 수 있어요.</p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            과목 담으러 가기
          </button>
        </div>
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                주간 시간표
                <span className="ml-2 text-base font-normal text-muted-foreground">{scopedCart.length}개</span>
              </h2>
              <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
                총 {totalCredits}학점
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">과목을 클릭하면 삭제 등 관리를 할 수 있어요.</p>
            <div className="mt-3">
              <WeeklyTimetable
                cart={scopedCart}
                activeCourseId={managingCourseId}
                onSessionClick={(courseId, trigger) => {
                  manageCourseTriggerRef.current = trigger
                  setManagingCourseId(courseId)
                }}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">내 선호도 적합 분석</h2>
                <p className="mt-1 text-sm text-muted-foreground">현재 담은 시간표가 원하는 시간대와 공강에 얼마나 맞는지 확인해요.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                적합도 {preferenceEvaluation.score}점
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">선호 시간대</span>
                <select
                  value={timePreference}
                  onChange={(event) => setTimePreference(event.target.value as TimePreference)}
                  className="input"
                >
                  <option value="any">상관없음</option>
                  <option value="morning">오전 중심</option>
                  <option value="afternoon">오후 중심</option>
                </select>
              </label>
              <div>
                <p className="mb-1.5 text-sm font-medium text-foreground">희망 공강 요일</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const selected = preferredFreeDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePreferredFreeDay(day)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:border-primary/40",
                        )}
                      >
                        {day}요일
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">수업 시작 가능</span>
                <select value={allowedStartHour} onChange={(event) => setAllowedStartHour(event.target.value)} className="input">
                  {[9, 10, 11, 12, 13].map((hour) => <option key={hour} value={hour}>{hour}:00 이후</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">수업 종료 제한</span>
                <select value={allowedEndHour} onChange={(event) => setAllowedEndHour(event.target.value)} className="input">
                  {[15, 16, 17, 18, 19, 20, 21].map((hour) => <option key={hour} value={hour}>{hour}:00 이전</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">최소 학점</span>
                <input type="number" min="0" max="30" value={minCredits} onChange={(event) => setMinCredits(event.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">최대 학점</span>
                <input type="number" min="1" max="30" value={maxCredits} onChange={(event) => setMaxCredits(event.target.value)} className="input" />
              </label>
            </div>

            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {preferenceEvaluation.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-primary" aria-hidden="true">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleGenerateCandidates}
              disabled={isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              분반 조합 추천받기
            </button>

            {candidateMessage ? <p className="mt-3 text-sm text-muted-foreground" role="status">{candidateMessage}</p> : null}

            {scheduleCandidates.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {scheduleCandidates.map((candidate, index) => (
                  <article key={candidate.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-foreground">후보 {index + 1}</h3>
                      <span className="text-sm font-bold text-primary">{candidate.score}점</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {candidate.courses.map((course) => (
                        <li key={course.id} className="truncate">
                          {course.name} · {course.professor} {course.code ? `(${course.code})` : ""}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-medium text-foreground">
                      예상 이동 {candidate.estimatedWalkMinutes}분
                    </p>
                    {candidate.validationIssues.length > 0 ? (
                      <ul className="mt-2 space-y-1 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                        {candidate.validationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">확인된 선수과목·학년 경고 없음</p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApplyCandidate(candidate)}
                      disabled={isPending || candidate.validationIssues.some((issue) => issue.includes("같은 학기에"))}
                      className="mt-4 w-full rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
                    >
                      이 후보 적용
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {noScheduleCourses.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-bold text-foreground">
                시간 정보가 없는 과목
                <span className="ml-2 text-base font-normal text-muted-foreground">{noScheduleCourses.length}개</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                수업 시간 정보가 없어 위 시간표에는 표시되지 않지만, 담은 과목에는 포함돼 있어요.
              </p>

              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {noScheduleCourses.map((course) => (
                  <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{course.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {course.department} · {course.professor} · {course.credits}학점
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCourse(course.id)}
                      aria-label={`${course.name} 장바구니에서 삭제`}
                      className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">요일별 이동동선</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              요일을 선택하면 그날 이동해야 하는 강의실 동선을 지도로 볼 수 있어요.
            </p>

            <div className="mt-3 flex gap-1.5 overflow-x-auto">
              {WEEKDAYS.map((day) => {
                const hasData = getSessionsForDay(scopedCart, day).length > 0
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      displayedDay === day
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent",
                    )}
                  >
                    {day}요일
                    {hasData && (
                      <span
                        className={cn(
                          "ml-1.5 inline-block size-1.5 rounded-full align-middle",
                          displayedDay === day ? "bg-primary-foreground" : "bg-primary",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <CampusMap day={displayedDay} cart={scopedCart} />
            </div>
          </section>
        </>
      )}

      {otherSemesterItems.length > 0 && (
        <OtherSemesterNotice items={otherSemesterItems} onRemove={removeCourse} />
      )}

      <CourseManagePopup
        course={managingCourse}
        triggerRef={manageCourseTriggerRef}
        fallbackFocusRef={manageCourseFallbackRef}
        onClose={() => setManagingCourseId(null)}
        onRemove={() => {
          if (!managingCourse) return
          removeCourse(managingCourse.id)
          setManagingCourseId(null)
        }}
      />

      <AddCourseModal
        open={addModalOpen}
        semester={activeSemester}
        query={query}
        department={department}
        departments={departments}
        grade={grade}
        category={category}
        browsableCourses={browsableCourses}
        browsableTotalCount={browsableTotalCount}
        browsableTotalPages={browsableTotalPages}
        page={page}
        viewerDepartment={viewerDepartment}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  )
}

function OtherSemesterNotice({
  items,
  onRemove,
}: {
  items: CartCourse[]
  onRemove: (courseId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-muted-foreground"
      >
        <span>다른 학기에 담아둔 과목 {items.length}개는 이 시간표에 표시되지 않아요</span>
        <span className="text-primary">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <ul className="mt-3 divide-y divide-border">
          {items.map((course) => (
            <li key={course.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{course.name}</p>
                <p className="truncate text-xs text-muted-foreground">{formatSemesterLabel(course.semester)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(course.id)}
                aria-label={`${course.name} 장바구니에서 삭제`}
                className="shrink-0 rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CourseManagePopup({
  course,
  triggerRef,
  fallbackFocusRef,
  onClose,
  onRemove,
}: {
  course: CartCourse | null
  triggerRef: RefObject<HTMLButtonElement | null>
  fallbackFocusRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onRemove: () => void
}) {
  const sessions = course ? buildSessionsForCourse(course) : []

  return (
    <Dialog.Root
      open={course !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {course && (
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Popup
              finalFocus={() => {
                const trigger = triggerRef.current
                return trigger?.isConnected ? trigger : fallbackFocusRef.current
              }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elevated outline-none"
            >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Dialog.Title className="truncate font-display text-base font-bold text-foreground">{course.name}</Dialog.Title>
            <Dialog.Description className="mt-0.5 truncate text-sm text-muted-foreground">
              {course.department} · {course.professor} · {course.credits}학점
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="닫기"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:size-8"
          >
            <X className="size-4" aria-hidden="true" />
          </Dialog.Close>
        </div>

        {sessions.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {sessions.map((session, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{session.day}요일</span>
                <span>
                  {formatMinutes(session.startMinutes)}~{formatMinutes(session.endMinutes)}
                </span>
                {session.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {session.location.building} {session.location.room}호
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/courses/${course.id}`}
          className="mt-5 flex items-center justify-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          <Info className="size-4" aria-hidden="true" />
          자세히 보기
        </Link>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="flex-1 rounded-full bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/15"
          >
            시간표에서 삭제
          </button>
          <Dialog.Close
            className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
          >
            닫기
          </Dialog.Close>
        </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  )
}
