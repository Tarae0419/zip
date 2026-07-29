"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CalendarDays, ShoppingCart, Trash2 } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { SemesterPicker } from "@/components/semester-picker"
import { WeeklyTimetable } from "@/components/weekly-timetable"
import { CampusMap } from "@/components/campus-map"
import { WEEKDAYS } from "@/lib/timetable/types"
import type { CartCourse, Weekday } from "@/lib/timetable/types"
import { formatSemesterLabel, getSessionsForDay } from "@/lib/timetable/schedule"
import { cn } from "@/lib/utils"

export function CartTimetableView({ availableSemesters }: { availableSemesters: string[] }) {
  const { cart, mounted, selectedSemester, clearSelectedSemester, removeCourse } = useCart()
  const [selectedDay, setSelectedDay] = useState<Weekday>("월")
  const [dayManuallySelected, setDayManuallySelected] = useState(false)

  const scopedCart = selectedSemester ? cart.filter((c) => c.semester === selectedSemester) : []
  const otherSemesterItems = selectedSemester ? cart.filter((c) => c.semester !== selectedSemester) : []
  const totalCredits = scopedCart.reduce((sum, c) => sum + c.credits, 0)

  // 기본 선택 요일("월")에 담은 강의가 하나도 없으면 지도가 "이 요일엔 강의가 없어요"만 보여줘
  // 마치 데이터가 안 뜨는 것처럼 보인다 — 실제로 수업이 있는 첫 요일을 자동으로 선택해준다.
  useEffect(() => {
    if (!mounted || dayManuallySelected || scopedCart.length === 0) return
    const dayWithData = WEEKDAYS.find((day) => getSessionsForDay(scopedCart, day).length > 0)
    if (dayWithData) setSelectedDay(dayWithData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, selectedSemester, cart, dayManuallySelected])

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    )
  }

  if (!selectedSemester) {
    return <SemesterPicker availableSemesters={availableSemesters} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <span className="font-display text-base font-bold text-foreground">
            {formatSemesterLabel(selectedSemester)} 시간표
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/cart/courses?semester=${encodeURIComponent(selectedSemester)}`}
            className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            과목 추가하기
          </Link>
          <button
            type="button"
            onClick={clearSelectedSemester}
            className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
          >
            학기 변경
          </button>
        </div>
      </div>

      {scopedCart.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingCart className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-foreground">
            {formatSemesterLabel(selectedSemester)}에 담은 강의가 없어요
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            이 학기에 개설된 과목을 담아 시간표와 이동동선을 확인해보세요.
          </p>
          <Link
            href={`/cart/courses?semester=${encodeURIComponent(selectedSemester)}`}
            className="mt-5 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {formatSemesterLabel(selectedSemester)} 과목 담으러 가기
          </Link>
        </div>
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                담은 강의
                <span className="ml-2 text-base font-normal text-muted-foreground">{scopedCart.length}개</span>
              </h2>
              <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
                총 {totalCredits}학점
              </span>
            </div>

            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {scopedCart.map((course) => (
                <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
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

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">주간 시간표</h2>
            <div className="mt-3">
              <WeeklyTimetable cart={scopedCart} />
            </div>
          </section>

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
