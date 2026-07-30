"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { curricula } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/auth/admin"

export type AdminActionResult = { ok: true } | { ok: false; error: string }

export type CurriculumInput = {
  department: string
  admissionYear: number
  requiredCourseCodes: string[]
  electiveMinCredits: number
  generalEducationRequirement: Record<string, number>
  totalCreditsRequired: number
  dataStatus: "illustrative" | "confirmed"
}

function validate(input: CurriculumInput): string | null {
  if (!input.department.trim()) return "학과명을 입력해주세요."
  if (!Number.isInteger(input.admissionYear) || input.admissionYear < 2000 || input.admissionYear > 2100) {
    return "입학년도를 올바르게 입력해주세요."
  }
  if (input.electiveMinCredits < 0 || input.totalCreditsRequired < 0) {
    return "학점은 0 이상이어야 해요."
  }
  return null
}

function revalidateCurricula() {
  revalidatePath("/admin/curricula")
  revalidatePath("/curriculum")
}

/** PRD 13.5 — 새 학과 커리큘럼을 추가하면 코드 배포 없이 F4(/curriculum) 지원 대상에 포함된다. */
export async function adminCreateCurriculum(input: CurriculumInput): Promise<AdminActionResult> {
  await requireAdmin()
  const error = validate(input)
  if (error) return { ok: false, error }

  try {
    await db.insert(curricula).values({
      department: input.department.trim(),
      admissionYear: input.admissionYear,
      requiredCourseCodes: input.requiredCourseCodes,
      electiveMinCredits: input.electiveMinCredits,
      generalEducationRequirement: input.generalEducationRequirement,
      totalCreditsRequired: input.totalCreditsRequired,
      dataStatus: input.dataStatus,
    })
  } catch {
    return { ok: false, error: "이미 같은 학과·입학년도 조합이 있어요." }
  }

  revalidateCurricula()
  return { ok: true }
}

export async function adminUpdateCurriculum(id: string, input: CurriculumInput): Promise<AdminActionResult> {
  await requireAdmin()
  const error = validate(input)
  if (error) return { ok: false, error }

  const [existing] = await db.select({ id: curricula.id }).from(curricula).where(eq(curricula.id, id)).limit(1)
  if (!existing) return { ok: false, error: "커리큘럼을 찾을 수 없어요." }

  try {
    await db
      .update(curricula)
      .set({
        department: input.department.trim(),
        admissionYear: input.admissionYear,
        requiredCourseCodes: input.requiredCourseCodes,
        electiveMinCredits: input.electiveMinCredits,
        generalEducationRequirement: input.generalEducationRequirement,
        totalCreditsRequired: input.totalCreditsRequired,
        dataStatus: input.dataStatus,
      })
      .where(eq(curricula.id, id))
  } catch {
    return { ok: false, error: "이미 같은 학과·입학년도 조합이 있어요." }
  }

  revalidateCurricula()
  return { ok: true }
}

export async function adminDeleteCurriculum(id: string): Promise<AdminActionResult> {
  await requireAdmin()
  await db.delete(curricula).where(eq(curricula.id, id))
  revalidateCurricula()
  return { ok: true }
}
