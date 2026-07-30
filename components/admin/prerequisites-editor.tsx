"use client"

import { useState, useTransition } from "react"
import { adminSetPrerequisites } from "@/lib/actions/admin/courses"

export function PrerequisitesEditor({ courseId, initialCodes }: { courseId: string; initialCodes: string[] }) {
  const [value, setValue] = useState(initialCodes.join(", "))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleSave() {
    setMessage(null)
    const codes = value
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
    startTransition(async () => {
      const result = await adminSetPrerequisites(courseId, codes)
      setMessage(result.ok ? "저장했어요." : result.error)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="학수번호를 쉼표로 구분 (예: UCAI006, UCAI003)"
        className="h-9 w-80 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
      >
        저장
      </button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  )
}
