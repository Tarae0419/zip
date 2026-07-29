"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { CartCourse } from "@/lib/timetable/types"

const STORAGE_KEY = "sugang-cart-v1"

type CartContextValue = {
  cart: CartCourse[]
  mounted: boolean
  totalCredits: number
  hasCourse: (courseId: string) => boolean
  addCourse: (course: CartCourse) => void
  removeCourse: (courseId: string) => void
  toggleCourse: (course: CartCourse) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartCourse[]>([])
  const [mounted, setMounted] = useState(false)

  // localStorage는 클라이언트에만 존재 — 서버 렌더 결과와 다를 수 있어 mount 이후에 읽는다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setCart(JSON.parse(raw) as CartCourse[])
    } catch {
      // 손상된 값이면 빈 장바구니로 시작
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart, mounted])

  const value = useMemo<CartContextValue>(() => {
    const hasCourse = (courseId: string) => cart.some((c) => c.id === courseId)
    const addCourse = (course: CartCourse) => {
      setCart((prev) => (prev.some((c) => c.id === course.id) ? prev : [...prev, course]))
    }
    const removeCourse = (courseId: string) => {
      setCart((prev) => prev.filter((c) => c.id !== courseId))
    }
    const toggleCourse = (course: CartCourse) => {
      setCart((prev) =>
        prev.some((c) => c.id === course.id) ? prev.filter((c) => c.id !== course.id) : [...prev, course],
      )
    }
    return {
      cart,
      mounted,
      totalCredits: cart.reduce((sum, c) => sum + c.credits, 0),
      hasCourse,
      addCourse,
      removeCourse,
      toggleCourse,
    }
  }, [cart, mounted])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart는 CartProvider 안에서만 사용할 수 있어요")
  return ctx
}
