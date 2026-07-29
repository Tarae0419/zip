"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ShoppingCart, Trash2 } from "lucide-react"
import { useCart } from "@/components/cart-provider"
import { WeeklyTimetable } from "@/components/weekly-timetable"
import { CampusMap } from "@/components/campus-map"
import { WEEKDAYS } from "@/lib/timetable/types"
import type { Weekday } from "@/lib/timetable/types"
import { getSessionsForDay } from "@/lib/timetable/schedule"
import { cn } from "@/lib/utils"

export function CartTimetableView() {
  const { cart, mounted, totalCredits, removeCourse } = useCart()
  const [selectedDay, setSelectedDay] = useState<Weekday>("월")
  const [dayManuallySelected, setDayManuallySelected] = useState(false)

  // 기본 선택 요일("월")에 담은 강의가 하나도 없으면 지도가 "이 요일엔 강의가 없어요"만 보여줘
  // 마치 데이터가 안 뜨는 것처럼 보인다 — 실제로 수업이 있는 첫 요일을 자동으로 선택해준다.
  useEffect(() => {
    if (!mounted || dayManuallySelected || cart.length === 0) return
    const dayWithData = WEEKDAYS.find((day) => getSessionsForDay(cart, day).length > 0)
    if (dayWithData) setSelectedDay(dayWithData)
  }, [mounted, cart, dayManuallySelected])

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShoppingCart className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-4 font-display text-lg font-semibold text-foreground">아직 담은 강의가 없어요</p>
        <p className="mt-1 text-sm text-muted-foreground">
          과목 카드나 상세 페이지에서 &quot;장바구니 담기&quot;를 눌러 시간표와 이동동선을 확인해보세요.
        </p>
        <Link
          href="/search"
          className="mt-5 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          과목 검색하러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-foreground">
            담은 강의
            <span className="ml-2 text-base font-normal text-muted-foreground">{cart.length}개</span>
          </h2>
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
            총 {totalCredits}학점
          </span>
        </div>

        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {cart.map((course) => (
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
          <WeeklyTimetable cart={cart} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-foreground">요일별 이동동선</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          요일을 선택하면 그날 이동해야 하는 강의실 동선을 지도로 볼 수 있어요.
        </p>

        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {WEEKDAYS.map((day) => {
            const hasData = getSessionsForDay(cart, day).length > 0
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
          <CampusMap day={selectedDay} cart={cart} />
        </div>
      </section>
    </div>
  )
}
