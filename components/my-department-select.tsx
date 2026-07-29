"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2 } from "lucide-react"
import { setMyDepartment } from "@/lib/actions/user-profile"

export function MyDepartmentSelect({
  departments,
  currentDepartment,
}: {
  departments: string[]
  currentDepartment: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    if (!value) return
    startTransition(async () => {
      await setMyDepartment(value)
      router.refresh()
    })
  }

  return (
    <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
      <GraduationCap className="size-4 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">내 학과</span>
      <select
        value={currentDepartment ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="bg-transparent font-medium text-foreground outline-none"
      >
        <option value="" disabled>
          선택 안 함
        </option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
    </label>
  )
}
