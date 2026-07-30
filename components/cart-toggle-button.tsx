"use client"

import { useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Check, Loader2, ShoppingCart, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"
import { getCartCourseInfo } from "@/lib/actions/cart"
import { findTimeConflict, formatMinutes } from "@/lib/timetable/schedule"
import type { TimeConflict } from "@/lib/timetable/types"

export function CartToggleButton({
  courseId,
  size = "default",
  className,
}: {
  courseId: string
  size?: "sm" | "default"
  className?: string
}) {
  const { mounted, cart, hasCourse, addCourse, removeCourse } = useCart()
  const [loading, setLoading] = useState(false)
  const [conflict, setConflict] = useState<TimeConflict | null>(null)
  const inCart = mounted && hasCourse(courseId)

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    // course-card.tsx는 카드 전체가 클릭 가능한 stretched-link라 상세 페이지 이동을 막아야 한다.
    e.preventDefault()
    e.stopPropagation()

    if (inCart) {
      removeCourse(courseId)
      return
    }

    setLoading(true)
    try {
      const info = await getCartCourseInfo(courseId)
      if (!info) return

      const timeConflict = findTimeConflict(info, cart)
      if (timeConflict) {
        setConflict(timeConflict)
        return
      }

      addCourse(info)
    } finally {
      setLoading(false)
    }
  }

  const isSmall = size === "sm"

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-pressed={inCart}
        className={cn(
          "relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors disabled:cursor-wait disabled:opacity-70",
          isSmall ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
          inCart
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-input bg-card text-foreground hover:border-primary/40 hover:bg-accent",
          className,
        )}
      >
        {loading ? (
          <Loader2 className={cn("animate-spin", isSmall ? "size-3.5" : "size-4")} aria-hidden="true" />
        ) : inCart ? (
          <Check className={isSmall ? "size-3.5" : "size-4"} aria-hidden="true" />
        ) : (
          <ShoppingCart className={isSmall ? "size-3.5" : "size-4"} aria-hidden="true" />
        )}
        {inCart ? "담김" : "장바구니 담기"}
      </button>

      {/* CourseCard 조상이 hover 시 transform(translate)을 걸어서(카드 살짝 뜨는 효과) fixed 모달이 그
          카드 안에 갇혀 렌더링되는 문제가 있었다 — body로 포탈해서 뷰포트 기준으로 항상 중앙에 뜨게 한다. */}
      {conflict && typeof document !== "undefined"
        ? createPortal(<TimeConflictModal conflict={conflict} onClose={() => setConflict(null)} />, document.body)
        : null}
    </>
  )
}

function TimeConflictModal({ conflict, onClose }: { conflict: TimeConflict; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label="시간표 충돌"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 font-display text-base font-bold text-foreground">시간표가 겹쳐요</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{conflict.existingCourseName}</span>과(와) 수업 시간이 겹쳐서 담을 수
          없어요.
        </p>

        <div className="mt-3 space-y-1.5 rounded-xl bg-secondary/50 p-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">이미 담은 과목</span> · {conflict.existingSession.day}요일{" "}
            {formatMinutes(conflict.existingSession.startMinutes)}~{formatMinutes(conflict.existingSession.endMinutes)}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">담으려는 과목</span> · {conflict.newSession.day}요일{" "}
            {formatMinutes(conflict.newSession.startMinutes)}~{formatMinutes(conflict.newSession.endMinutes)}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-accent"
        >
          확인
        </button>
      </div>
    </div>
  )
}
