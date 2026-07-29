import OpenAI from "openai"

// 이 프로젝트의 .env.local 키 이름은 OPEN_AI_API_KEY다 (SDK 기본값인 OPENAI_API_KEY가 아님).
const apiKey = process.env.OPEN_AI_API_KEY
if (!apiKey) {
  throw new Error("OPEN_AI_API_KEY가 설정되어 있지 않습니다 (.env.local 확인)")
}

export const openai = new OpenAI({ apiKey })

// 분류/짧은 요약 작업에 비용·속도 균형이 좋은 모델. 필요 시 이 상수만 바꾸면 된다.
export const AI_MODEL = "gpt-4o-mini"
