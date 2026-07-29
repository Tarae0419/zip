// 산업/진로 분야 태그 시딩 + 임베딩 생성 (PRD 8.3 요구사항 1, 10.3).
// 실행: pnpm db:seed-industry-tags (재실행해도 안전 — 이름 기준 upsert, 임베딩도 매번 재생성)
import { eq } from "drizzle-orm"
import { db } from "../client"
import { industryTags } from "../schema"
import { openai } from "../../ai/openai-client"

const EMBEDDING_MODEL = "text-embedding-3-small"

type IndustryTagSeed = {
  name: string
  description: string
  icon: string
  keywords: string[]
}

// lib/mock-data.ts의 fieldCategories와 동일한 6개 카테고리로 시작한다(연속성 유지, 아이콘도 그대로 재사용).
// PRD 8.3 요구사항 6에 따라 신산업 분야는 이후에도 이 배열에 계속 추가할 수 있다.
const INDUSTRY_TAGS: IndustryTagSeed[] = [
  {
    name: "반도체",
    description: "공정·소자·회로 설계까지 반도체 산업 전반",
    icon: "Cpu",
    keywords: ["웨이퍼", "반도체 공정", "소자", "회로설계", "클린룸", "반도체 장비", "나노공정"],
  },
  {
    name: "AI·데이터사이언스",
    description: "머신러닝, 통계, 데이터 분석의 기초와 응용",
    icon: "BrainCircuit",
    keywords: ["인공지능", "머신러닝", "딥러닝", "데이터분석", "빅데이터", "통계", "알고리즘"],
  },
  {
    name: "바이오·헬스케어",
    description: "생명공학과 디지털 헬스케어 융합 과목",
    icon: "HeartPulse",
    keywords: ["생명공학", "바이오", "헬스케어", "의료기기", "제약", "임상", "디지털헬스"],
  },
  {
    name: "금융·핀테크",
    description: "금융공학, 계량분석, 핀테크 서비스 설계",
    icon: "LineChart",
    keywords: ["금융공학", "핀테크", "투자", "리스크관리", "계량분석", "블록체인", "자산운용"],
  },
  {
    name: "콘텐츠·미디어",
    description: "미디어 기획, 인터랙션, 콘텐츠 기술",
    icon: "Clapperboard",
    keywords: ["미디어", "콘텐츠제작", "영상", "게임", "인터랙션디자인", "방송", "스토리텔링"],
  },
  {
    name: "에너지·환경",
    description: "신재생 에너지와 지속가능성 관련 과목",
    icon: "Leaf",
    keywords: ["신재생에너지", "태양광", "이차전지", "탄소중립", "환경공학", "지속가능성", "에너지저장"],
  },
]

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text })
  return res.data[0].embedding
}

async function main() {
  for (const tag of INDUSTRY_TAGS) {
    const embeddingText = `${tag.name}: ${tag.description}. 관련 키워드: ${tag.keywords.join(", ")}`
    const embedding = await embed(embeddingText)

    const [existing] = await db.select({ id: industryTags.id }).from(industryTags).where(eq(industryTags.name, tag.name)).limit(1)
    if (existing) {
      await db
        .update(industryTags)
        .set({ description: tag.description, icon: tag.icon, embedding })
        .where(eq(industryTags.id, existing.id))
    } else {
      await db.insert(industryTags).values({ name: tag.name, description: tag.description, icon: tag.icon, embedding })
    }
    console.log(`시딩 완료: ${tag.name}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
