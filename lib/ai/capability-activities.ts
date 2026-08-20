import { AI_MODEL, openai } from "./openai-client"
import { buildFallbackCapabilityActivities, sanitizeCapabilityActivities } from "@/lib/curriculum/capability-activities"
import type { CapabilityActivity } from "@/lib/curriculum/types"

export async function generateCapabilityActivities(params: {
  grade: number
  department: string
  careerKeyword?: string
  interestFieldNames: string[]
}): Promise<CapabilityActivity[]> {
  const fallback = buildFallbackCapabilityActivities(params)
  if (!params.careerKeyword?.trim() && params.interestFieldNames.length === 0) return fallback

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "capability_activities",
          strict: true,
          schema: {
            type: "object",
            properties: {
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    grade: { type: "integer" },
                    title: { type: "string" },
                    category: { type: "string", enum: ["프로젝트", "비교과", "자격증", "진로탐색"] },
                    expectedCapability: { type: "string" },
                    reason: { type: "string" },
                    evidenceBasis: { type: "string" },
                    confidence: { type: "string", enum: ["높음", "보통", "낮음"] },
                  },
                  required: ["grade", "title", "category", "expectedCapability", "reason", "evidenceBasis", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["activities"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `너는 대학생의 학년별 역량 개발 활동을 제안하는 도우미다. 현재 학년부터 4학년까지 학년마다 1~3개 활동을 한국어로 제안해라. 입력에 없는 특정 교내 프로그램명, 자격증 필수 여부, 채용 요건을 지어내지 마라. 자격증은 공식 출처가 제공되지 않았으므로 일반적인 탐색·준비 활동으로만 표현하고 확신 수준을 낮춰라. evidenceBasis에는 입력 중 어떤 정보에 근거했는지만 적어라.`,
        },
        { role: "user", content: JSON.stringify(params) },
      ],
    })
    const raw = completion.choices[0]?.message?.content
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { activities?: unknown }
    const activities = sanitizeCapabilityActivities(parsed.activities, params.grade)
    return activities.length > 0 ? activities : fallback
  } catch (error) {
    console.error("학년별 역량 활동 생성 실패, 기본 제안으로 대체합니다:", error)
    return fallback
  }
}
