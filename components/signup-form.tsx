"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Check, Compass, GraduationCap, Loader2, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requestSignup, verifySignupCode } from "@/lib/actions/auth"
import { cn } from "@/lib/utils"

type Step = "form" | "verify"

const STEPS: { key: Step; label: string }[] = [
  { key: "form", label: "정보 입력" },
  { key: "verify", label: "이메일 인증" },
]

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"

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
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-accent/40 to-background px-4 py-8">
      <div
        aria-hidden="true"
        className="bg-dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
      />

      <Link href="/" className="relative flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Compass className="size-5" aria-hidden="true" />
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-foreground">수강길잡이</span>
      </Link>

      <div className="animate-fade-in-up relative mt-5 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-primary/5">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-chart-2 to-chart-3" />

        <div className="p-5 pt-5">
          <StepIndicator step={step} />

          {step === "form" ? (
            <>
              <div className="flex items-center justify-center gap-2 text-center">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="size-4" aria-hidden="true" />
                </span>
                <h1 className="font-display text-lg font-bold text-foreground">회원가입</h1>
              </div>

              <form onSubmit={handleRequestSignup} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
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
                      placeholder="202012345"
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="department" className="text-sm font-medium text-foreground">
                      학과
                    </label>
                    <select
                      id="department"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        선택
                      </option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    학교 이메일
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@jbnu.ac.kr"
                      className={cn(fieldClass, "pl-9")}
                    />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                    @jbnu.ac.kr 이메일만 가입할 수 있어요.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
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
                      placeholder="8자 이상"
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1">
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
                      placeholder="다시 입력"
                      className={fieldClass}
                    />
                  </div>
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

              <p className="mt-3 text-center text-sm text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  로그인
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="text-center">
                <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-4" aria-hidden="true" />
                </span>
                <h1 className="mt-2 font-display text-lg font-bold text-foreground">이메일 인증</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{email}</span>로 인증코드를 보냈어요
                </p>
              </div>

              <form onSubmit={handleVerify} className="mt-4 space-y-3">
                <OtpInput value={code} onChange={setCode} />
                <p className="text-center text-xs text-muted-foreground">10분 안에 입력해주세요.</p>

                {error ? (
                  <p className="text-center text-sm font-medium text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full" size="lg">
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  인증하고 가입 완료
                </Button>
              </form>

              <div className="mt-3 flex items-center justify-between text-sm">
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
    </div>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="mb-4 flex items-center justify-center">
      {STEPS.map((s, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                  isDone || isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-3" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("text-[11px] font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn("mx-2 h-px w-8 transition-colors", isDone ? "bg-primary" : "bg-border")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 인증코드 입력을 6개짜리 개별 박스로 — 자동 포커스 이동, 백스페이스로 이전 칸 이동, 붙여넣기 지원. */
function OtpInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const length = 6
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setDigitAt(index: number, digit: string) {
    const chars = value.padEnd(length, " ").split("")
    chars[index] = digit
    onChange(
      chars
        .join("")
        .replace(/\s+$/, "")
        .slice(0, length),
    )
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1)
    if (!digit) return
    setDigitAt(index, digit)
    if (index < length - 1) refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace") return
    e.preventDefault()
    if (value[index]) {
      setDigitAt(index, "")
    } else if (index > 0) {
      setDigitAt(index - 1, "")
      refs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!pasted) return
    onChange(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete="one-time-code"
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="size-11 rounded-xl border border-input bg-background text-center text-lg font-bold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
          aria-label={`인증코드 ${i + 1}번째 자리`}
        />
      ))}
    </div>
  )
}
