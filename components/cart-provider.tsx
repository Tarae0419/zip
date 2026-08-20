"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { CartCourse } from "@/lib/timetable/types"
import { addCartItem, getCartItems, removeCartItem } from "@/lib/actions/cart"
import { applyPreferredScheduleCandidate } from "@/lib/actions/schedule-preferences"

type CartContextValue = {
  cart: CartCourse[]
  mounted: boolean
  totalCredits: number
  hasCourse: (courseId: string) => boolean
  addCourse: (course: CartCourse) => void
  removeCourse: (courseId: string) => void
  toggleCourse: (course: CartCourse) => void
  replaceSemesterCart: (semester: string, courses: CartCourse[]) => Promise<boolean>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartCourse[]>([])
  const [mounted, setMounted] = useState(false)

  // 로그인 계정(anonId) 기준으로 DB에서 불러온다 — 예전엔 localStorage(브라우저 단위)라
  // 같은 브라우저에서 계정을 바꿔도 장바구니가 그대로 보이는 문제가 있었다(2026-08-01 수정).
  useEffect(() => {
    let cancelled = false
    getCartItems()
      .then((items) => {
        if (!cancelled) setCart(items)
      })
      .catch(() => {
        // 조회 실패 시 빈 장바구니로 시작
      })
      .finally(() => {
        if (!cancelled) setMounted(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<CartContextValue>(() => {
    const hasCourse = (courseId: string) => cart.some((c) => c.id === courseId)

    // 화면은 즉시 반영(낙관적 업데이트)하고, 실제 저장은 백그라운드 서버 액션으로 보낸다.
    // 실패해도 별도 롤백/재시도는 하지 않는다 — 다음 새로고침 시 getCartItems가 서버 상태로
    // 다시 맞춰준다(리뷰 등록 실패 처리와 달리, 담기/빼기는 실패해도 치명적이지 않다고 판단).
    const addCourse = (course: CartCourse) => {
      setCart((prev) => (prev.some((c) => c.id === course.id) ? prev : [...prev, course]))
      addCartItem(course.id).catch(() => {})
    }

    const removeCourse = (courseId: string) => {
      setCart((prev) => prev.filter((c) => c.id !== courseId))
      removeCartItem(courseId).catch(() => {})
    }

    const toggleCourse = (course: CartCourse) => {
      setCart((prev) => {
        const exists = prev.some((c) => c.id === course.id)
        if (exists) {
          removeCartItem(course.id).catch(() => {})
          return prev.filter((c) => c.id !== course.id)
        }
        addCartItem(course.id).catch(() => {})
        return [...prev, course]
      })
    }

    const replaceSemesterCart = async (semester: string, nextCourses: CartCourse[]) => {
      const previous = cart
      setCart((current) => [...current.filter((course) => course.semester !== semester), ...nextCourses])
      try {
        const result = await applyPreferredScheduleCandidate(semester, nextCourses.map((course) => course.id))
        if (!result.ok) setCart(previous)
        return result.ok
      } catch {
        setCart(previous)
        return false
      }
    }

    return {
      cart,
      mounted,
      totalCredits: cart.reduce((sum, c) => sum + c.credits, 0),
      hasCourse,
      addCourse,
      removeCourse,
      toggleCourse,
      replaceSemesterCart,
    }
  }, [cart, mounted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart는 CartProvider 안에서만 사용할 수 있어요")
  return ctx
}
