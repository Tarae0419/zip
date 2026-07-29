// 학문분야 태그(대분류-소분류) 시딩. PRD 8.2 요구사항 2·6.
// 실행: pnpm db:seed-field-tags (재실행해도 안전 — 이름 기준 upsert)
// tsx --env-file=.env.local로 실행할 것 — dotenv/config import는 ESM import hoisting 때문에
// lib/db/client.ts의 top-level DATABASE_URL 체크보다 늦게 실행되어 동작하지 않는다.
import { eq } from "drizzle-orm"
import { db } from "../client"
import { fieldTags } from "../schema"

type Node = { name: string; synonyms?: string[]; children?: Node[] }

// 실제 DB의 147개 개설학과 이름을 훑어보고 구성한 분류 체계.
// 예술·체육/의약보건/농림수산 등 이 대학의 실제 학과 구성을 반영했다 — 표준 분류 체계를 그대로 가져온 게 아니다.
const TAXONOMY: Node[] = [
  {
    name: "인문학",
    children: [
      { name: "국어국문학" },
      { name: "영미어문학", synonyms: ["영어영문학"] },
      { name: "독일어권언어문화", synonyms: ["독어독문학", "독일학"] },
      { name: "프랑스어권언어문화", synonyms: ["불어불문학"] },
      { name: "스페인·중남미언어문화", synonyms: ["서어서문학"] },
      { name: "중국어중문학" },
      { name: "일본언어문화", synonyms: ["일어일문학"] },
      { name: "역사학", synonyms: ["사학"] },
      { name: "철학" },
      { name: "문헌정보학" },
      { name: "고고학·인류학" },
    ],
  },
  {
    name: "사회과학",
    children: [
      { name: "정치외교학" },
      { name: "사회학" },
      { name: "심리학" },
      { name: "행정학" },
      { name: "사회복지학" },
      { name: "언론정보학", synonyms: ["미디어커뮤니케이션학"] },
      { name: "지리학" },
      { name: "국제학", synonyms: ["국제협력"] },
    ],
  },
  {
    name: "상경·경영",
    children: [
      { name: "경영학" },
      { name: "경제학" },
      { name: "회계학" },
      { name: "무역학", synonyms: ["국제무역학"] },
      { name: "금융·재무" },
    ],
  },
  { name: "법학", children: [{ name: "법학일반", synonyms: ["공공형사법", "지식재산"] }] },
  {
    name: "자연과학",
    children: [
      { name: "수학", synonyms: ["수리과학"] },
      { name: "통계학" },
      { name: "물리학" },
      { name: "화학" },
      { name: "생명과학", synonyms: ["생물학", "분자생물학"] },
      { name: "지구환경과학", synonyms: ["지구과학"] },
      { name: "천문학" },
      { name: "과학기술학", synonyms: ["과학학"] },
    ],
  },
  {
    name: "공학",
    children: [
      { name: "컴퓨터공학·소프트웨어", synonyms: ["전산학", "컴퓨터과학", "소프트웨어공학", "인공지능"] },
      { name: "전기전자공학", synonyms: ["전자공학", "전기공학"] },
      { name: "기계공학", synonyms: ["기계설계공학", "기계시스템공학"] },
      { name: "화학공학", synonyms: ["화공"] },
      { name: "건축·도시공학", synonyms: ["건축학", "도시공학"] },
      { name: "토목공학" },
      { name: "신소재·나노공학", synonyms: ["신소재공학", "나노공학", "고분자공학"] },
      { name: "산업공학", synonyms: ["산업정보시스템공학"] },
      { name: "항공우주공학" },
      { name: "에너지·자원공학", synonyms: ["자원공학", "이차전지공학"] },
      { name: "반도체공학", synonyms: ["반도체과학기술"] },
      { name: "환경공학" },
      { name: "IT융합공학", synonyms: ["IT융합기전공학", "IT응용시스템공학"] },
    ],
  },
  {
    name: "의약·보건계열",
    children: [
      { name: "의학", synonyms: ["의예과"] },
      { name: "치의학", synonyms: ["치의예과"] },
      { name: "한의학" },
      { name: "약학" },
      { name: "간호학" },
      { name: "수의학", synonyms: ["수의예과"] },
      { name: "보건·의료공학", synonyms: ["헬스케어기기공학", "헬스케어정보공학", "바이오메디컬공학"] },
    ],
  },
  {
    name: "농림수산·생명계열",
    children: [
      { name: "농생명과학", synonyms: ["농생물학", "농업생명과학"] },
      { name: "산림·환경자원학", synonyms: ["산림환경과학"] },
      { name: "동물자원과학", synonyms: ["동물생명공학"] },
      { name: "식품공학·영양학", synonyms: ["식품영양학", "식품유통학"] },
      { name: "원예·조경학", synonyms: ["조경학", "생태조경디자인"] },
      { name: "생물산업기계공학" },
    ],
  },
  {
    name: "예술·체육",
    children: [
      { name: "음악", synonyms: ["한국음악"] },
      { name: "미술·디자인", synonyms: ["산업디자인"] },
      { name: "무용" },
      { name: "체육·스포츠과학", synonyms: ["스포츠과학"] },
      { name: "영상·미디어콘텐츠", synonyms: ["메타버스", "엔터테인먼트"] },
    ],
  },
  {
    name: "교육학",
    children: [{ name: "교육학일반" }, { name: "교과교육" }],
  },
]

async function upsertNode(node: Node, parentId: string | null): Promise<void> {
  const [existing] = await db.select({ id: fieldTags.id }).from(fieldTags).where(eq(fieldTags.name, node.name)).limit(1)

  let id: string
  if (existing) {
    id = existing.id
    await db
      .update(fieldTags)
      .set({ parentId, synonyms: node.synonyms ?? [] })
      .where(eq(fieldTags.id, id))
  } else {
    const [inserted] = await db
      .insert(fieldTags)
      .values({ name: node.name, parentId, synonyms: node.synonyms ?? [] })
      .returning({ id: fieldTags.id })
    id = inserted.id
  }

  for (const child of node.children ?? []) {
    await upsertNode(child, id)
  }
}

async function main() {
  for (const top of TAXONOMY) {
    await upsertNode(top, null)
  }
  const all = await db.select().from(fieldTags)
  console.log(`총 ${all.length}개 태그 시딩 완료 (대분류 ${TAXONOMY.length}개)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
