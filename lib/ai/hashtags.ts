import { predefinedReviewTags } from "@/lib/mock-data"
import { AI_MODEL, openai } from "./openai-client"

/**
 * PRD 8.1 요구사항 2 — 자유 텍스트를 바탕으로 사전 정의 해시태그 중 후보를 추천한다.
 * 새 태그를 만들어내지 않고 predefinedReviewTags 안에서만 고르도록 프롬프트로 제약하고,
 * 모델 응답도 서버에서 한 번 더 그 목록으로 필터링한다(모델을 신뢰하지 않는다).
 */
export async function suggestHashtags(body: string): Promise<string[]> {
  const trimmed = body.trim()
  if (trimmed.length < 10) return []

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `너는 대학 강의 수강평에서 핵심 특징을 뽑아 해시태그로 분류하는 도우미야. 아래 "사전 정의된 해시태그" 목록 중에서만 골라야 하고, 본문 내용과 명확히 관련된 태그만 최대 3개까지 골라. 관련된 태그가 없으면 빈 배열을 반환해.

사전 정의된 해시태그: ${predefinedReviewTags.join(", ")}

반드시 다음 JSON 형식으로만 응답해: {"tags": ["태그1", "태그2"]}`,
      },
      { role: "user", content: trimmed },
    ],
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as { tags?: unknown }
    if (!Array.isArray(parsed.tags)) return []
    const allowed = new Set(predefinedReviewTags)
    return parsed.tags.filter((t): t is string => typeof t === "string" && allowed.has(t)).slice(0, 3)
  } catch {
    return []
  }
}
