"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Compass, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { login } from "@/lib/actions/auth"

export default function LoginPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await login({ studentId, password })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Compass className="size-5" aria-hidden="true" />
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-foreground">수강길잡이</span>
      </Link>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-foreground">로그인</h1>
          <p className="mt-1 text-sm text-muted-foreground">학번으로 로그인하고 맞춤 추천을 받아보세요</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="studentId" className="text-sm font-medium text-foreground">
              학번
            </label>
            <input
              id="studentId"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="예: 202012345"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            로그인
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}
