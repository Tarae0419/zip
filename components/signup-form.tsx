"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Compass, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requestSignup, verifySignupCode } from "@/lib/actions/auth"

type Step = "form" | "verify"

export function SignupForm({ departments }: { departments: string[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("form")

  const [studentId, setStudentId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [department, setDepartment] = useState("")
  const [code, setCode] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleRequestSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.")
      return
    }
    if (!department) {
      setError("학과를 선택해주세요.")
      return
    }

    setIsSubmitting(true)
    const result = await requestSignup({ studentId, email, password })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    setStep("verify")
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await verifySignupCode({ email, code, department })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    router.push("/")
    router.refresh()
  }

  async function handleResend() {
    setError(null)
    setIsSubmitting(true)
    const result = await requestSignup({ studentId, email, password })
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    setCode("")
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
        {step === "form" ? (
          <>
            <div className="text-center">
              <h1 className="font-display text-xl font-bold text-foreground">회원가입</h1>
              <p className="mt-1 text-sm text-muted-foreground">학교 이메일로 인증하고 시작해보세요</p>
            </div>

            <form onSubmit={handleRequestSignup} className="mt-6 space-y-4">
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
                <label htmlFor="department" className="text-sm font-medium text-foreground">
                  학과
                </label>
                <select
                  id="department"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                >
                  <option value="" disabled>
                    학과를 선택해주세요
                  </option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">내 전공 과목 비교, 커리큘럼 추천 등에 계속 쓰여요.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  학교 이메일
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@jbnu.ac.kr"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
                <p className="text-xs text-muted-foreground">@jbnu.ac.kr 이메일만 가입할 수 있어요.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상 입력하세요"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="passwordConfirm" className="text-sm font-medium text-foreground">
                  비밀번호 확인
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 한 번 더 입력하세요"
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
                인증코드 받기
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                로그인
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <h1 className="mt-3 font-display text-xl font-bold text-foreground">이메일 인증</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email}</span>로 인증코드를 보냈어요
              </p>
            </div>

            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="code" className="text-sm font-medium text-foreground">
                  인증코드
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6자리 숫자"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-center text-lg font-semibold tracking-[0.3em] text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
                <p className="text-xs text-muted-foreground">10분 안에 입력해주세요.</p>
              </div>

              {error ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full" size="lg">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                인증하고 가입 완료
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-muted-foreground transition hover:text-foreground"
              >
                이전으로
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={isSubmitting}
                className="font-medium text-primary transition hover:underline disabled:opacity-60"
              >
                코드 다시 받기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
