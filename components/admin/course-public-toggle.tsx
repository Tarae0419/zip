"use client"

import { useTransition } from "react"
import { adminSetCoursePublic } from "@/lib/actions/admin/courses"

export function CoursePublicToggle({ courseId, isPublic }: { courseId: string; isPublic: boolean }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await adminSetCoursePublic(courseId, !isPublic)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        isPublic
          ? "rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          : "rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-primary/10 hover:text-primary disabled:opacity-50"
      }
    >
      {isPublic ? "공개" : "비공개"}
    </button>
  )
}
