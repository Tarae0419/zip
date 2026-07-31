import { AI_MODEL, openai } from "./openai-client"
import type { AiPlacement, AiPlanRequest } from "@/lib/curriculum/ai-plan-types"

/**
 * F4 요구사항 6~11(전공필수 배치 포함 전체 커리큘럼 설계)을 1차로 AI에 맡긴다 — 2026-07-31 결정,
 * docs/SPRINT_PLAN.md 오픈 이슈 로그 참고. 근접 중복 시리즈 과목(예: "반도체소재"/"반도체소재1")을
 * 문맥으로 판단해 피하는 것이 목적이라, 결정론적 문자열 dedup만으로는 못 잡는 사례를 다룬다.
 *
 * 모델에게는 courseCode/semesterIndex/reason 3필드만 되돌려받는다 — type·credits·name 등은
 * 항상 서버가 이미 아는 후보 데이터에서 가져오고 모델 응답을 신뢰하지 않는다(lib/ai/hashtags.ts와
 * 동일한 "모델을 신뢰하지 않는다" 패턴). 반환값은 방어적으로 1차 필터링된다 — 후보 풀에 없는 코드,
 * 범위 밖 semesterIndex, 빈 reason, 중복 courseCode는 여기서 이미 제거하고 넘긴다. 그래도 필수과목
 * 완결성·선수과목 순서·학점상한 같은 불변식은 이 함수가 보장하지 않으므로, 반드시 호출부가
 * lib/curriculum/reconcile-ai-plan.ts로 검증·보정해야 한다. 실패하면 null을 반환하고, 호출부가
 * 기존 결정론적 파이프라인으로 전체 폴백한다.
 */
export async function planCurriculumWithAI(request: AiPlanRequest): Promise<AiPlacement[] | null> {
  if (request.candidates.length === 0) return []

  const validCodes = new Set(request.candidates.map((c) => c.courseCode))

  let raw: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "curriculum_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              placements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    courseCode: { type: "string" },
                    semesterIndex: { type: "integer" },
                    reason: { type: "string" },
                  },
                  required: ["courseCode", "semesterIndex", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["placements"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: "system", content: buildSystemPrompt(request) },
        { role: "user", content: JSON.stringify(buildUserPayload(request)) },
      ],
    })
    const message = completion.choices[0]?.message
    if (message?.refusal) return null
    raw = message?.content
  } catch (err) {
    console.error("AI 커리큘럼 설계 호출 실패:", err)
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { placements?: unknown }
    if (!Array.isArray(parsed.placements)) return null

    const seen = new Set<string>()
    const result: AiPlacement[] = []
    for (const entry of parsed.placements) {
      if (typeof entry !== "object" || entry === null) continue
      const { courseCode, semesterIndex, reason } = entry as Record<string, unknown>
      if (typeof courseCode !== "string" || !validCodes.has(courseCode) || seen.has(courseCode)) continue
      if (typeof semesterIndex !== "number" || !Number.isInteger(semesterIndex)) continue
      if (semesterIndex < 0 || semesterIndex >= request.remainingSemesters) continue
      if (typeof reason !== "string" || !reason.trim()) continue
      seen.add(courseCode)
      result.push({ courseCode, semesterIndex, reason: reason.trim() })
    }
    return result
  } catch {
    return null
  }
}

function buildSystemPrompt(request: AiPlanRequest): string {
  return `너는 대학생의 남은 학기 수강 계획을 설계하는 도우미야. 아래 규칙을 반드시 지켜.

1. "requiredCourseCodes" 목록에 있는 과목은 하나도 빠짐없이 정확히 한 번씩, semesterIndex 0부터 ${request.remainingSemesters - 1} 사이에 배치해.
2. 어떤 과목의 prerequisiteCodes에 있는 코드가 candidates 안에도 있다면, 그 선수과목은 반드시 더 이른 semesterIndex에 배치해.
3. 각 과목의 grade(권장 학년)는 해당 semesterIndex의 semesterGrades 값보다 1개 학년까지만 미리 들을 수 있어. 그보다 훨씬 이르면 피해.
4. 학기당 목표 학점은 16, 절대 넘으면 안 되는 상한은 18학점이야.
5. electiveMinCreditsRemaining만큼은 category가 "전공선택"인 후보로 우선 채우고, 남는 자리는 관심분야("관심분야" category, interestFieldNames와 연관도 높은 순) 후보로 채워.
6. 과목명이 사실상 같은 시리즈로 보이면(예: "반도체소재"와 "반도체소재1", "OOO및실험"과 "OOO및실습" 같은 이론/실습 짝) 그중 관련도와 학년이 가장 적절한 하나만 고르고 여러 개를 동시에 넣지 마. 이게 이 도구의 핵심 목적이야 — 비슷한 과목을 중복 추천하지 않는 것.
7. isOwnMajor가 false인 후보를 고를 때는 reason에 "타 전공 과목이라 수강 가능 여부를 별도로 확인해야 한다"는 취지를 짧게 덧붙여.
8. 학점 인정 여부는 정확히 말해야 해 — requirementType이 "전공선택"이고 isOwnMajor가 true일 때만 "전공선택 학점으로 인정된다"고 말할 수 있어. requirementType이 "교양"이면 "교양 학점으로 활용할 수 있다"고 말해. 그 외(다른 이수구분·타 전공)에는 특정 학점 인정을 단정하지 마.
9. category가 "전공선택"이든 "관심분야"든, relevanceScore가 있는 후보는 reason에 왜 그 관심분야와 관련 있는지(과목명·분야 연관성)를 구체적으로 설명해 — "연관도가 높습니다"처럼 뭉뚱그리지 말고 어떤 면에서 관련 있는지 한 마디라도 덧붙여.
10. reason은 한국어 한 문장으로, 왜 이 과목을 이 학기에 추천하는지 자연스럽게 써. 없는 사실을 지어내지 마.
11. courseCode는 candidates에 실제로 있는 값만 사용해. 새로운 코드를 만들어내지 마.
12. 응답은 반드시 지정된 JSON 스키마 형식으로만 해.`
}

function buildUserPayload(request: AiPlanRequest) {
  return {
    remainingSemesters: request.remainingSemesters,
    semesterLabels: request.semesterLabels,
    semesterGrades: request.semesterGrades,
    interestFieldNames: request.interestFieldNames,
    totalRemainingCreditsNeeded: request.totalRemainingCreditsNeeded,
    electiveMinCreditsRemaining: request.electiveMinCreditsRemaining,
    requiredCourseCodes: request.requiredCourseCodes,
    candidates: request.candidates.map((c) => ({
      courseCode: c.courseCode,
      name: c.name,
      department: c.department,
      credits: c.credits,
      category: c.category,
      requirementType: c.requirementType,
      prerequisiteCodes: c.prerequisiteCodes,
      grade: c.grade,
      isOwnMajor: c.isOwnMajor,
      relevanceScore: c.relevanceScore,
    })),
  }
}
