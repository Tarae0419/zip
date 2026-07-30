"use client"

import { useTransition } from "react"
import { adminDeleteCurriculum } from "@/lib/actions/admin/curricula"

export function CurriculumDeleteButton({ id, label }: { id: string; label: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!window.confirm(`"${label}" 커리큘럼을 삭제할까요? F4 추천 대상에서 즉시 제외돼요.`)) return
    startTransition(() => {
      adminDeleteCurriculum(id)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-full border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
    >
      삭제
    </button>
  )
}
