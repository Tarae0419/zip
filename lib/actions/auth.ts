"use server"

import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { emailVerifications, users } from "@/lib/db/schema"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { sendVerificationCodeEmail } from "@/lib/auth/mailer"
import { createSession, destroySession } from "@/lib/auth/session"

type ActionResult = { success: true } | { success: false; message: string }

const JBNU_EMAIL_RE = /^[^\s@]+@jbnu\.ac\.kr$/i
const STUDENT_ID_RE = /^\d{6,10}$/
const CODE_TTL_MS = 10 * 60 * 1000

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** 회원가입 1단계 — 학번/이메일/비밀번호를 받아 인증코드를 이메일로 보낸다. 계정은 아직 만들지 않는다. */
export async function requestSignup({
  studentId,
  email,
  password,
}: {
  studentId: string
  email: string
  password: string
}): Promise<ActionResult> {
  const trimmedStudentId = studentId.trim()
  const trimmedEmail = email.trim().toLowerCase()

  if (!STUDENT_ID_RE.test(trimmedStudentId)) {
    return { success: false, message: "학번은 6~10자리 숫자로 입력해주세요." }
  }
  if (!JBNU_EMAIL_RE.test(trimmedEmail)) {
    return { success: false, message: "학교 이메일(@jbnu.ac.kr)만 사용할 수 있어요." }
  }
  if (password.length < 8) {
    return { success: false, message: "비밀번호는 8자 이상이어야 해요." }
  }

  const [existingByStudentId] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.studentId, trimmedStudentId))
    .limit(1)
  if (existingByStudentId) {
    return { success: false, message: "이미 가입된 학번이에요." }
  }

  const [existingByEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, trimmedEmail)).limit(1)
  if (existingByEmail) {
    return { success: false, message: "이미 가입된 이메일이에요." }
  }

  // 같은 이메일로 재요청하면 예전 미인증 코드는 정리하고 새로 발급한다.
  await db.delete(emailVerifications).where(eq(emailVerifications.email, trimmedEmail))

  const passwordHash = await hashPassword(password)
  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  await db.insert(emailVerifications).values({
    studentId: trimmedStudentId,
    email: trimmedEmail,
    passwordHash,
    code,
    expiresAt,
  })

  await sendVerificationCodeEmail(trimmedEmail, code)

  return { success: true }
}

/**
 * 회원가입 2단계 — 인증코드를 확인하고 실제 계정을 만든 뒤 로그인 세션을 시작한다.
 * department는 1단계 화면에서 이미 골라둔 값을 그대로 넘겨받아 계정 생성 시 같이 저장한다
 * (/fields의 "내 전공 과목" 비교, F4 커리큘럼 등에서 바로 쓰인다 — 나중에 따로 설정할 필요 없게).
 */
export async function verifySignupCode({
  email,
  code,
  department,
}: {
  email: string
  code: string
  department: string
}): Promise<ActionResult> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedCode = code.trim()
  const trimmedDepartment = department.trim()

  if (!trimmedDepartment) {
    return { success: false, message: "학과를 선택해주세요." }
  }

  const [pending] = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, trimmedEmail), eq(emailVerifications.code, trimmedCode), isNull(emailVerifications.consumedAt)))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1)

  if (!pending) {
    return { success: false, message: "인증코드가 올바르지 않아요." }
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    return { success: false, message: "인증코드가 만료됐어요. 다시 요청해주세요." }
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        anonId: crypto.randomUUID(),
        studentId: pending.studentId,
        email: pending.email,
        passwordHash: pending.passwordHash,
        emailVerified: true,
        department: trimmedDepartment,
      })
      .returning({ anonId: users.anonId })

    await db.update(emailVerifications).set({ consumedAt: new Date() }).where(eq(emailVerifications.id, pending.id))
    await createSession(created.anonId)
    return { success: true }
  } catch {
    return { success: false, message: "이미 가입된 학번 또는 이메일이에요." }
  }
}

/** 로그인 — 학번 + 비밀번호. rememberMe가 false면 브라우저를 닫으면 사라지는 세션 쿠키로 로그인한다. */
export async function login({
  studentId,
  password,
  rememberMe = true,
}: {
  studentId: string
  password: string
  rememberMe?: boolean
}): Promise<ActionResult> {
  const trimmedStudentId = studentId.trim()
  const genericError = { success: false as const, message: "학번 또는 비밀번호가 올바르지 않아요." }

  const [user] = await db.select().from(users).where(eq(users.studentId, trimmedStudentId)).limit(1)
  if (!user || !user.passwordHash) return genericError

  const passwordMatches = await verifyPassword(password, user.passwordHash)
  if (!passwordMatches) return genericError

  await createSession(user.anonId, rememberMe)
  return { success: true }
}

export async function logout(): Promise<void> {
  await destroySession()
}
