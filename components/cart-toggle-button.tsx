"use client"

import { useState, type MouseEvent } from "react"
import { Check, Loader2, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"
import { getCartCourseInfo } from "@/lib/actions/cart"

export function CartToggleButton({
  courseId,
  size = "default",
  className,
}: {
  courseId: string
  size?: "sm" | "default"
  className?: string
}) {
  const { mounted, hasCourse, addCourse, removeCourse } = useCart()
  const [loading, setLoading] = useState(false)
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
      if (info) addCourse(info)
    } finally {
      setLoading(false)
    }
  }

  const isSmall = size === "sm"

  return (
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
  )
}
