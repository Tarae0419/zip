"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import type { Course } from "@/lib/types"
import { CourseCard } from "@/components/course-card"
import { SemesterCourseFilterBar } from "@/components/semester-course-filter-bar"
import { formatSemesterLabel } from "@/lib/timetable/schedule"

export function AddCourseModal({
  semester,
  query,
  department,
  departments,
  grade,
  category,
  browsableCourses,
  viewerDepartment,
  onClose,
}: {
  semester: string
  query: string
  department: string
  departments: string[]
  grade: string
  category: string
  browsableCourses: Course[]
  viewerDepartment: string | null
  onClose: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-elevated sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="과목 추가"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">과목 추가</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatSemesterLabel(semester)}에 개설된 과목만 보여드려요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <SemesterCourseFilterBar query={query} department={department} departments={departments} grade={grade} category={category} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {browsableCourses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              조건에 맞는 과목이 없어요. 다른 과목명이나 학과로 찾아보세요.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {query || department !== "전체" || grade !== "전체" ? "검색 결과" : "수강인원이 많은 순으로 보여드려요"} ·{" "}
                {browsableCourses.length}개
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {browsableCourses.map((course) => (
                  <CourseCard key={course.id} course={course} viewerDepartment={viewerDepartment} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
