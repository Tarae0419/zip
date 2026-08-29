"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react"
import type { Course } from "@/lib/types"
import { CourseCard } from "@/components/course-card"
import { SemesterCourseFilterBar } from "@/components/semester-course-filter-bar"
import { formatSemesterLabel } from "@/lib/timetable/schedule"
import { cn } from "@/lib/utils"

export function AddCourseModal({
  open,
  semester,
  query,
  department,
  departments,
  grade,
  category,
  browsableCourses,
  browsableTotalCount,
  browsableTotalPages,
  page,
  viewerDepartment,
  onClose,
}: {
  open: boolean
  semester: string
  query: string
  department: string
  departments: string[]
  grade: string
  category: string
  browsableCourses: Course[]
  browsableTotalCount: number
  browsableTotalPages: number
  page: number
  viewerDepartment: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete("page")
    else params.set("page", String(nextPage))
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const hasFilters = Boolean(query) || department !== "전체" || grade !== "전체" || category !== "전체"

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup className="flex max-h-[85svh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-elevated outline-none sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <Dialog.Title className="font-display text-lg font-bold text-foreground">과목 추가</Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
              {formatSemesterLabel(semester)}에 개설된 과목만 보여드려요
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="닫기"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:size-8"
          >
            <X className="size-5" aria-hidden="true" />
          </Dialog.Close>
        </div>

        <div className="border-b border-border px-5 py-3">
          <SemesterCourseFilterBar query={query} department={department} departments={departments} grade={grade} category={category} />
        </div>

        <div
          aria-busy={isPending}
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 transition-opacity", isPending && "opacity-60")}
        >
          {browsableCourses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              조건에 맞는 과목이 없어요. 다른 과목명이나 학과로 찾아보세요.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "검색 결과" : "수강인원이 많은 순으로 보여드려요"} · 총 {browsableTotalCount}개
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {browsableCourses.map((course) => (
                  <CourseCard key={course.id} course={course} viewerDepartment={viewerDepartment} />
                ))}
              </div>
            </>
          )}
        </div>

        {browsableTotalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="이전 페이지"
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground" role="status" aria-live="polite" aria-atomic="true">
              {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              {page} / {browsableTotalPages} 페이지
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= browsableTotalPages}
              aria-label="다음 페이지"
              className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
