"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, Info, Loader2, MapPin, Plus, ShoppingCart, Trash2, X } from "lucide-react"
import type { Course } from "@/lib/types"
import { useCart } from "@/components/cart-provider"
import { AddCourseModal } from "@/components/add-course-modal"
import { WeeklyTimetable } from "@/components/weekly-timetable"
import { CampusMap } from "@/components/campus-map"
import { WEEKDAYS } from "@/lib/timetable/types"
import type { CartCourse, Weekday } from "@/lib/timetable/types"
import { buildSessionsForCourse, formatMinutes, formatSemesterLabel, getSessionsForDay } from "@/lib/timetable/schedule"
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
  const { cart, mounted, removeCourse } = useCart()
  const [selectedDay, setSelectedDay] = useState<Weekday>("월")
  const [dayManuallySelected, setDayManuallySelected] = useState(false)
  const [managingCourseId, setManagingCourseId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  const scopedCart = cart.filter((c) => c.semester === activeSemester)
  const otherSemesterItems = cart.filter((c) => c.semester !== activeSemester)
  const totalCredits = scopedCart.reduce((sum, c) => sum + c.credits, 0)
  const managingCourse = scopedCart.find((c) => c.id === managingCourseId) ?? null
  // 시간표 그리드에 블록으로 안 뜨는(수업 시간 정보가 없는) 과목은 별도 목록으로 계속 보여준다 —
  // 안 그러면 관리(삭제)할 방법이 아예 없어진다.
  const noScheduleCourses = scopedCart.filter((c) => buildSessionsForCourse(c).length === 0)

  // Esc로 관리 팝업 닫기
  useEffect(() => {
    if (!managingCourseId) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setManagingCourseId(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [managingCourseId])

  // 기본 선택 요일("월")에 담은 강의가 하나도 없으면 지도가 "이 요일엔 강의가 없어요"만 보여줘
  // 마치 데이터가 안 뜨는 것처럼 보인다 — 실제로 수업이 있는 첫 요일을 자동으로 선택해준다.
  useEffect(() => {
    if (!mounted || dayManuallySelected || scopedCart.length === 0) return
    const dayWithData = WEEKDAYS.find((day) => getSessionsForDay(scopedCart, day).length > 0)
    if (dayWithData) setSelectedDay(dayWithData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, activeSemester, cart, dayManuallySelected])

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
              <WeeklyTimetable cart={scopedCart} activeCourseId={managingCourseId} onSessionClick={setManagingCourseId} />
            </div>
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
                    onClick={() => {
                      setSelectedDay(day)
                      setDayManuallySelected(true)
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      selectedDay === day
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent",
                    )}
                  >
                    {day}요일
                    {hasData && (
                      <span
                        className={cn(
                          "ml-1.5 inline-block size-1.5 rounded-full align-middle",
                          selectedDay === day ? "bg-primary-foreground" : "bg-primary",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <CampusMap day={selectedDay} cart={scopedCart} />
            </div>
          </section>
        </>
      )}

      {otherSemesterItems.length > 0 && (
        <OtherSemesterNotice items={otherSemesterItems} onRemove={removeCourse} />
      )}

      {managingCourse && (
        <CourseManagePopup
          course={managingCourse}
          onClose={() => setManagingCourseId(null)}
          onRemove={() => {
            removeCourse(managingCourse.id)
            setManagingCourseId(null)
          }}
        />
      )}

      {addModalOpen && (
        <AddCourseModal
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
      )}
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
  onClose,
  onRemove,
}: {
  course: CartCourse
  onClose: () => void
  onRemove: () => void
}) {
  const sessions = buildSessionsForCourse(course)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${course.name} 관리`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-foreground">{course.name}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {course.department} · {course.professor} · {course.credits}학점
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
