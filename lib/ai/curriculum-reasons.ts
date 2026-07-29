import { AI_MODEL, openai } from "./openai-client"

export type ElectiveReasonInput = {
  courseCode: string
  courseName: string
  department: string
  isOwnMajor: boolean
  matchedInterestField: string
}

/**
 * PRD 8.4 요구사항 11 / 10.3 — "관심분야 매칭 추천 부분만 LLM API에 위임"한다.
 * 어떤 과목을 추천할지(연관도 순위)는 이미 결정론적으로 정해졌고(lib/curriculum/plan.ts), 여기서는
 * 그 결과에 대한 한 문장짜리 추천 사유만 자연스럽게 다듬는다. 실패하면 호출부가 템플릿 문구를 그대로 쓴다.
 */
export async function writeElectiveReasons(items: ElectiveReasonInput[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (items.length === 0) return map

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `너는 대학 커리큘럼 추천 이유를 한 문장으로 자연스럽게 써주는 도우미야. 각 과목마다 왜 이 과목을 추천하는지 한국어 한 문장으로 써. 관심분야와의 연관성을 반영하고, 본인 전공이 아니면 "타 전공 과목이라 수강 가능 여부를 별도로 확인해야 한다"는 점도 짧게 덧붙여. 없는 사실을 지어내지 말고 과장하지 마. 반드시 다음 JSON 형식으로만 응답해: {"reasons": [{"code": "학수번호", "reason": "..."}]} 모든 입력 과목에 대해 결과를 하나씩 포함해.`,
      },
      {
        role: "user",
        content: JSON.stringify(
          items.map((i) => ({
            code: i.courseCode,
            name: i.courseName,
            department: i.department,
            ownMajor: i.isOwnMajor,
            interestField: i.matchedInterestField,
          })),
        ),
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) return map

  try {
    const parsed = JSON.parse(raw) as { reasons?: unknown }
    if (!Array.isArray(parsed.reasons)) return map
    for (const entry of parsed.reasons) {
      if (typeof entry !== "object" || entry === null) continue
      const { code, reason } = entry as { code?: unknown; reason?: unknown }
      if (typeof code === "string" && typeof reason === "string" && reason.trim()) {
        map.set(code, reason.trim())
      }
    }
  } catch {
    // 파싱 실패 — 빈 맵을 반환하고 호출부가 템플릿 사유를 유지한다.
  }
  return map
}
