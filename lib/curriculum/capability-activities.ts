import type { CapabilityActivity } from "./types"

export function buildFallbackCapabilityActivities(params: {
  grade: number
  department: string
  careerKeyword?: string
  interestFieldNames: string[]
}): CapabilityActivity[] {
  const focus = params.careerKeyword?.trim() || params.interestFieldNames[0] || "전공 분야"
  const grades = Array.from({ length: 5 - params.grade }, (_, index) => params.grade + index)

  return grades.flatMap((grade) => {
    const project: CapabilityActivity = {
      grade,
      title: `${focus} 미니 프로젝트 완성`,
      category: "프로젝트",
      expectedCapability: `${focus} 관련 문제를 정의하고 결과물을 설명하는 역량`,
      reason: `${params.department} 전공 지식을 실제 결과물로 연결해 포트폴리오 근거를 만들기 위한 기본 제안입니다.`,
      evidenceBasis: `입력 학과(${params.department})와 관심 키워드(${focus})`,
      confidence: "보통",
      sourceType: "기본 제안",
    }
    const exploration: CapabilityActivity = {
      grade,
      title: `${focus} 직무·산업 사례 조사`,
      category: "진로탐색",
      expectedCapability: "관심 직무의 요구 역량과 자신의 학습 계획을 비교하는 역량",
      reason: "구체적인 공식 비교과 정보가 연결되기 전에도 진로 탐색을 시작할 수 있도록 제안합니다.",
      evidenceBasis: `사용자 관심 키워드(${focus})`,
      confidence: "보통",
      sourceType: "기본 제안",
    }
    return [project, exploration]
  })
}

export function sanitizeCapabilityActivities(value: unknown, minGrade: number): CapabilityActivity[] {
  if (!Array.isArray(value)) return []
  const categories = new Set(["프로젝트", "비교과", "자격증", "진로탐색"])
  const confidences = new Set(["높음", "보통", "낮음"])
  const result: CapabilityActivity[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue
    const item = entry as Record<string, unknown>
    if (typeof item.grade !== "number" || !Number.isInteger(item.grade) || item.grade < minGrade || item.grade > 4) continue
    if (typeof item.title !== "string" || !item.title.trim()) continue
    if (typeof item.expectedCapability !== "string" || !item.expectedCapability.trim()) continue
    if (typeof item.reason !== "string" || !item.reason.trim()) continue
    if (typeof item.evidenceBasis !== "string" || !item.evidenceBasis.trim()) continue
    if (!categories.has(String(item.category)) || !confidences.has(String(item.confidence))) continue
    result.push({
      grade: item.grade,
      title: item.title.trim().slice(0, 100),
      category: item.category as CapabilityActivity["category"],
      expectedCapability: item.expectedCapability.trim().slice(0, 300),
      reason: item.reason.trim().slice(0, 400),
      evidenceBasis: item.evidenceBasis.trim().slice(0, 300),
      confidence: item.confidence as CapabilityActivity["confidence"],
      sourceType: "AI 제안",
    })
  }
  return result.slice(0, 12)
}
