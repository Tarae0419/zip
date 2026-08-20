"use server"

import { AI_MODEL, openai } from "@/lib/ai/openai-client"
import { hasEnoughStudyEvidence } from "@/lib/study/storage"
import type { InterviewQuestion, StudyCourseRecord } from "@/lib/study/types"

type StudyGenerationResult =
  | { ok: true; summary: string; questions: InterviewQuestion[] }
  | { ok: false; error: string }

export async function generateStudyInsights(input: Pick<StudyCourseRecord, "courseName" | "objective" | "weeklyNotes" | "assignments" | "exams" | "careerKeyword">): Promise<StudyGenerationResult> {
  const safe = {
    courseName: input.courseName.trim().slice(0, 200),
    objective: input.objective.trim().slice(0, 3000),
    weeklyNotes: input.weeklyNotes.trim().slice(0, 8000),
    assignments: input.assignments.trim().slice(0, 3000),
    exams: input.exams.trim().slice(0, 3000),
    careerKeyword: input.careerKeyword.trim().slice(0, 100),
  }
  if (!hasEnoughStudyEvidence(safe)) {
    return { ok: false, error: "강의 목표, 주차 메모, 과제 또는 시험 정보를 합해 40자 이상 입력해주세요." }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "study_insights",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    intent: { type: "string" },
                    evidence: { type: "string" },
                  },
                  required: ["question", "intent", "evidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "questions"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: "너는 대학 수업 기록을 요약하고 면접 질문을 만드는 도우미다. 반드시 사용자가 제공한 자료에 있는 사실만 사용해 3~5문장으로 요약해라. 면접 질문은 최대 5개이며 관심 직무가 있으면 연결하되, evidence에는 답변에 활용할 수 있는 사용자 입력 근거를 구체적으로 적어라. 자료에 없는 강의 내용, 성과, 기술을 지어내지 마라.",
        },
        { role: "user", content: JSON.stringify(safe) },
      ],
    })
    const raw = completion.choices[0]?.message?.content
    if (!raw) return { ok: false, error: "AI 응답을 받지 못했어요." }
    const parsed = JSON.parse(raw) as { summary?: unknown; questions?: unknown }
    if (typeof parsed.summary !== "string" || !parsed.summary.trim() || !Array.isArray(parsed.questions)) {
      return { ok: false, error: "AI 응답 형식이 올바르지 않아요." }
    }
    const questions = parsed.questions.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return []
      const item = entry as Record<string, unknown>
      if (typeof item.question !== "string" || typeof item.intent !== "string" || typeof item.evidence !== "string") return []
      return [{ question: item.question.trim().slice(0, 300), intent: item.intent.trim().slice(0, 500), evidence: item.evidence.trim().slice(0, 500) }]
    }).filter((item) => item.question && item.intent && item.evidence).slice(0, 5)
    return { ok: true, summary: parsed.summary.trim().slice(0, 4000), questions }
  } catch (error) {
    console.error("수업 인사이트 생성 실패:", error)
    return { ok: false, error: "AI 생성 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." }
  }
}
