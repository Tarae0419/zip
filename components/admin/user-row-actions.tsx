"use client"

import { useState, useTransition } from "react"
import { adminSetUserRole, adminSetUserStatus } from "@/lib/actions/admin/users"

export function UserRowActions({
  userId,
  role,
  status,
}: {
  userId: string
  role: "user" | "admin"
  status: "active" | "suspended"
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggleStatus() {
    setError(null)
    startTransition(async () => {
      const result = await adminSetUserStatus(userId, status === "active" ? "suspended" : "active")
      if (!result.ok) setError(result.error)
    })
  }

  function toggleRole() {
    setError(null)
    startTransition(async () => {
      const result = await adminSetUserRole(userId, role === "admin" ? "user" : "admin")
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleRole}
          disabled={isPending}
          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {role === "admin" ? "관리자 해제" : "관리자 지정"}
        </button>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={isPending}
          className={
            status === "active"
              ? "rounded-full border border-destructive/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
              : "rounded-full border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
          }
        >
          {status === "active" ? "정지" : "정지 해제"}
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
