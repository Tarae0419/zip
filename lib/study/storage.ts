import type { InterviewQuestion, StudyCourseRecord, StudyHubData } from "./types"

export const STUDY_HUB_STORAGE_KEY = "study-hub-v1"

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

function sanitizeQuestions(value: unknown): InterviewQuestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null) return []
    const item = raw as Record<string, unknown>
    const question = text(item.question, 300).trim()
    const intent = text(item.intent, 500).trim()
    const evidence = text(item.evidence, 500).trim()
    return question && intent && evidence ? [{ question, intent, evidence }] : []
  }).slice(0, 10)
}

export function sanitizeStudyHubData(value: unknown): StudyHubData | null {
  if (typeof value !== "object" || value === null) return null
  const data = value as Record<string, unknown>
  if (data.version !== 1 || !Array.isArray(data.records)) return null
  const records: StudyCourseRecord[] = []
  const seen = new Set<string>()
  for (const raw of data.records) {
    if (typeof raw !== "object" || raw === null) continue
    const item = raw as Record<string, unknown>
    const courseId = text(item.courseId, 100)
    const semester = text(item.semester, 20)
    if (!courseId || !semester || seen.has(`${courseId}|${semester}`)) continue
    seen.add(`${courseId}|${semester}`)
    records.push({
      courseId,
      courseName: text(item.courseName, 200) || "과목명 없음",
      semester,
      objective: text(item.objective, 3000),
      weeklyNotes: text(item.weeklyNotes, 8000),
      assignments: text(item.assignments, 3000),
      exams: text(item.exams, 3000),
      careerKeyword: text(item.careerKeyword, 100),
      aiSummary: text(item.aiSummary, 4000),
      interviewQuestions: sanitizeQuestions(item.interviewQuestions),
      generatedAt: typeof item.generatedAt === "string" ? item.generatedAt : null,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    })
  }
  return { version: 1, records: records.slice(0, 100) }
}

export function hasEnoughStudyEvidence(record: Pick<StudyCourseRecord, "objective" | "weeklyNotes" | "assignments" | "exams">): boolean {
  return [record.objective, record.weeklyNotes, record.assignments, record.exams].join(" ").trim().length >= 40
}
