import { AI_MODEL, openai } from "./openai-client"

type ReviewForSummary = { rating: number; body: string; hashtags: string[] }

/**
 * PRD 8.1 요구사항 3, 예시 문구 참고 — 3~5문장, 전반적 평가 경향·대표 장단점·추천 대상을 포함.
 * Edge Case: 평점이 뚜렷하게 갈리면 "호불호가 갈리는 강의"임을 요약에 명시한다.
 */
export async function generateCourseSummary(
  courseName: string,
  professor: string | null,
  reviews: ReviewForSummary[],
): Promise<string> {
  const ratings = reviews.map((r) => r.rating)
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const positiveCount = ratings.filter((r) => r >= 4).length
  const negativeCount = ratings.filter((r) => r <= 2).length
  const isPolarized = positiveCount > 0 && negativeCount > 0 && positiveCount + negativeCount >= ratings.length * 0.6

  const reviewLines = reviews
    .map((r, i) => `${i + 1}. (평점 ${r.rating}/5${r.hashtags.length ? ", 태그: " + r.hashtags.join(", ") : ""}) ${r.body}`)
    .join("\n")

  const systemPrompt = [
    "너는 대학 강의 수강평을 종합해 요약하는 도우미야.",
    "아래 규칙을 반드시 지켜서 한국어로 3~5문장 요약을 작성해:",
    "- 전반적인 평가 경향, 대표적인 장점과 단점, 어떤 학생에게 추천하는지를 포함한다.",
    isPolarized ? "- 평점이 뚜렷하게 갈리는(호불호가 갈리는) 강의이므로 이 사실을 요약에 명시한다." : "",
    "- 리뷰에 실제로 나온 내용만 근거로 삼고, 없는 사실을 지어내지 않는다.",
    "- 결과는 요약 문장만 출력하고, 다른 설명이나 따옴표를 덧붙이지 않는다.",
  ]
    .filter(Boolean)
    .join("\n")

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `과목명: ${courseName}${professor ? ` (${professor} 교수)` : ""}\n평균 평점: ${avg.toFixed(1)}/5 (리뷰 ${reviews.length}건)\n\n${reviewLines}`,
      },
    ],
  })

  return completion.choices[0]?.message?.content?.trim() ?? ""
}
