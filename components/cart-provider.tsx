"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { CartCourse } from "@/lib/timetable/types"

const STORAGE_KEY = "sugang-cart-v1"
// 장바구니 목록과 별도 키로 저장 — 예전 버전(학기 선택 기능 이전)에 저장된 배열 형식 그대로 읽을 수 있게
// 장바구니 저장 포맷 자체는 건드리지 않는다.
const SEMESTER_STORAGE_KEY = "sugang-cart-semester-v1"

type CartContextValue = {
  cart: CartCourse[]
  mounted: boolean
  totalCredits: number
  selectedSemester: string | null
  hasCourse: (courseId: string) => boolean
  addCourse: (course: CartCourse) => void
  removeCourse: (courseId: string) => void
  toggleCourse: (course: CartCourse) => void
  setSelectedSemester: (semester: string) => void
  clearSelectedSemester: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartCourse[]>([])
  const [selectedSemester, setSelectedSemesterState] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // localStorage는 클라이언트에만 존재 — 서버 렌더 결과와 다를 수 있어 mount 이후에 읽는다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setCart(JSON.parse(raw) as CartCourse[])
      const semester = window.localStorage.getItem(SEMESTER_STORAGE_KEY)
      if (semester) setSelectedSemesterState(semester)
    } catch {
      // 손상된 값이면 빈 장바구니로 시작
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart, mounted])

  useEffect(() => {
    if (!mounted) return
    if (selectedSemester) window.localStorage.setItem(SEMESTER_STORAGE_KEY, selectedSemester)
    else window.localStorage.removeItem(SEMESTER_STORAGE_KEY)
  }, [selectedSemester, mounted])

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
      selectedSemester,
      hasCourse,
      addCourse,
      removeCourse,
      toggleCourse,
      setSelectedSemester: setSelectedSemesterState,
      clearSelectedSemester: () => setSelectedSemesterState(null),
    }
  }, [cart, mounted, selectedSemester])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart는 CartProvider 안에서만 사용할 수 있어요")
  return ctx
}
