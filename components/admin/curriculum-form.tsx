"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { adminCreateCurriculum, adminUpdateCurriculum, type CurriculumInput } from "@/lib/actions/admin/curricula"

type InitialValue = {
  id: string
  department: string
  admissionYear: number
  requiredCourseCodes: string[]
  electiveMinCredits: number
  generalEducationRequirement: Record<string, number>
  totalCreditsRequired: number
  dataStatus: "illustrative" | "confirmed"
}

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"

function formatGenEd(req: Record<string, number>): string {
  return Object.entries(req)
    .map(([k, v]) => `${k}:${v}`)
    .join("\n")
}

function parseGenEd(text: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const line of text.split("\n")) {
    const [key, valueRaw] = line.split(":")
    const value = Number(valueRaw?.trim())
    if (key?.trim() && Number.isFinite(value)) result[key.trim()] = value
  }
  return result
}

export function CurriculumForm({ initial }: { initial?: InitialValue }) {
  const router = useRouter()
  const [department, setDepartment] = useState(initial?.department ?? "")
  const [admissionYear, setAdmissionYear] = useState(String(initial?.admissionYear ?? new Date().getFullYear()))
  const [requiredCourseCodes, setRequiredCourseCodes] = useState(initial?.requiredCourseCodes.join(", ") ?? "")
  const [electiveMinCredits, setElectiveMinCredits] = useState(String(initial?.electiveMinCredits ?? 0))
  const [generalEd, setGeneralEd] = useState(formatGenEd(initial?.generalEducationRequirement ?? {}))
  const [totalCreditsRequired, setTotalCreditsRequired] = useState(String(initial?.totalCreditsRequired ?? 130))
  const [dataStatus, setDataStatus] = useState<"illustrative" | "confirmed">(initial?.dataStatus ?? "illustrative")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input: CurriculumInput = {
      department,
      admissionYear: Number(admissionYear),
      requiredCourseCodes: requiredCourseCodes.split(",").map((c) => c.trim()).filter(Boolean),
      electiveMinCredits: Number(electiveMinCredits),
      generalEducationRequirement: parseGenEd(generalEd),
      totalCreditsRequired: Number(totalCreditsRequired),
      dataStatus,
    }

    startTransition(async () => {
      const result = initial ? await adminUpdateCurriculum(initial.id, input) : await adminCreateCurriculum(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push("/admin/curricula")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">학과명</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} required className={fieldClass} placeholder="예: 전자공학부" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">입학년도</label>
          <input type="number" value={admissionYear} onChange={(e) => setAdmissionYear(e.target.value)} required className={fieldClass} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">전공필수 과목 코드 (쉼표로 구분)</label>
        <input value={requiredCourseCodes} onChange={(e) => setRequiredCourseCodes(e.target.value)} className={fieldClass} placeholder="UCAI006, UCAI003, UCAI004" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">전공선택 최소 학점</label>
          <input type="number" value={electiveMinCredits} onChange={(e) => setElectiveMinCredits(e.target.value)} required className={fieldClass} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">총 이수 학점</label>
          <input type="number" value={totalCreditsRequired} onChange={(e) => setTotalCreditsRequired(e.target.value)} required className={fieldClass} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">교양 요건 (한 줄에 하나, "이름:학점")</label>
        <textarea
          value={generalEd}
          onChange={(e) => setGeneralEd(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          placeholder={"기초교양:12\n균형교양:18\n핵심교양:6"}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">데이터 상태</label>
        <select value={dataStatus} onChange={(e) => setDataStatus(e.target.value as "illustrative" | "confirmed")} className={fieldClass}>
          <option value="illustrative">참고용 (더미 데이터)</option>
          <option value="confirmed">학과 사무실 확인 완료</option>
        </select>
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
        {initial ? "저장" : "커리큘럼 추가"}
      </button>
    </form>
  )
}
