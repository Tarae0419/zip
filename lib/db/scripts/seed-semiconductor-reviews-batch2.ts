// seed-semiconductor-reviews.ts에서 손으로 쓴 8개 과목(전자공학부 등 대표 과목) 외에, "반도체공학"
// 학문분야 태그가 붙은 나머지 모든 과목(총 35개 중 27개)에 F1 시연/테스트용 더미 리뷰를 채운다.
// 27개를 전부 손으로 쓰는 대신, 과목별 주제 키워드 + 문장 조각 풀을 조합하는 템플릿 방식을 쓴다 —
// 실제 학생 데이터가 아니다. 과목당 5개씩 넣어 AI 요약 최소 기준(5건)을 정확히 맞춘다.
// 재실행 시 중복 삽입을 피하려면 먼저 DB에서 해당 과목의 더미 리뷰(authorAnonId LIKE 'dummy-%')를
// 지우고 다시 실행할 것 — 이 스크립트 자체는 idempotent하지 않다.
// 실행: pnpm exec tsx --env-file=.env.local lib/db/scripts/seed-semiconductor-reviews-batch2.ts
import { db } from "../client"
import { courses, reviews, summaries } from "../schema"
import { generateCourseSummary } from "../../ai/summary"
import { inArray } from "drizzle-orm"

// 코드 없는 두 과목은 이름으로 courses.id를 조회한다(courses.code가 null인 실제 카탈로그 케이스).
const TARGET_CODES = [
  "UE&S026",
  "UELE032",
  "UEME051",
  "UEME079",
  "UIME028",
  "UIME065",
  "UIME067",
  "UMPE019",
  "UMPE024",
  "UMPE037",
  "UNBE073",
  "UNQE064",
  "USEM004",
  "USEM031",
  "USEM048",
  "USEM049",
  "USEM050",
  "USEM051",
  "USEM052",
  "USEM055",
  "USEM056",
  "USEM058",
  "USEM063",
  "USEM071",
  "USEM072",
]
const TARGET_NAMES_NO_CODE = ["(KNU10)생활속의반도체", "차세대반도체공정"]

// 과목별 주제 키워드 — 리뷰 문장에 자연스럽게 끼워 넣어 완전히 뻔한 템플릿처럼 보이지 않게 한다.
const TOPIC: Record<string, string> = {
  "UE&S026": "광전소자(LED·레이저) 동작 원리",
  UELE032: "플라즈마 방전과 반도체 식각 공정",
  UEME051: "포토리소그래피와 박막 증착 공정",
  UEME079: "화합물 반도체 소자 특성",
  UIME028: "MOSFET 등 소자 설계",
  UIME065: "반도체 패키징·본딩 공정",
  UIME067: "실습 장비를 다루는 실험",
  UMPE019: "반도체 공학에 필요한 수학적 기초",
  UMPE024: "웨이퍼 제조 공정 개론",
  UMPE037: "반도체 테스트·결함 검출 알고리즘",
  UNBE073: "바이오센서 융합 제작 실습",
  UNQE064: "플라즈마 기반 식각·증착 기초",
  USEM004: "양자역학과 에너지밴드 이론",
  USEM031: "홀 효과 등 물성 측정 실험",
  USEM048: "나노 스케일 소자와 미세공정",
  USEM049: "태양전지의 광기전 효과",
  USEM050: "클린룸에서의 포토공정 실습",
  USEM051: "식각·증착 공정 실습",
  USEM052: "박막 에피택시 성장",
  USEM055: "반도체 최신 연구 동향과 논문 세미나",
  USEM056: "반도체 최신 연구 동향과 논문 세미나",
  USEM058: "DRAM·NAND 등 메모리 셀 구조",
  USEM063: "소자 응용 회로 심화 이론",
  USEM071: "SEM·XPS를 이용한 표면 분석",
  USEM072: "배선 공정과 인터커넥트 신뢰성",
  "(KNU10)생활속의반도체": "일상 속 반도체 원리를 쉽게 풀어낸 내용",
  차세대반도체공정: "차세대 미세화 공정 기술",
}

const OPENERS = [
  (professor: string, topic: string) => `${professor} 교수님이 ${topic}을 차근차근 설명해주셔서 이해가 잘 됐어요.`,
  (professor: string, topic: string) => `${topic}을 처음 접했는데 ${professor} 교수님 강의 덕분에 전체 흐름을 잡을 수 있었습니다.`,
  (_: string, topic: string) => `이 수업에서 ${topic}을 꽤 깊이 있게 다뤄서 좋았어요.`,
  (professor: string, __: string) => `${professor} 교수님 강의 자료가 잘 정리되어 있어서 복습하기 편했습니다.`,
  (_: string, topic: string) => `${topic}에 관심 있으면 진입장벽이 낮은 편이라 부담 없이 들을 수 있어요.`,
]

const MIDDLES: { text: (topic: string) => string; tags: string[] }[] = [
  { text: (topic) => `다만 ${topic} 관련 수식·이론이 꽤 어려워서 예습이 필요했습니다.`, tags: ["시험어려움"] },
  { text: () => "과제가 매주 나오는 편이라 시간 관리가 필요해요.", tags: ["과제많음"] },
  { text: () => "시험 범위가 넓어서 벼락치기로는 따라가기 힘들었습니다.", tags: ["시험어려움"] },
  { text: () => "실습·실험 위주라 리포트 작성 부담이 좀 있었어요.", tags: ["과제많음", "실무중심"] },
  { text: () => "생각보다 난이도가 높지 않아서 편하게 들을 수 있었습니다.", tags: ["꿀강의"] },
  { text: () => "팀 프로젝트가 있어서 조원들과 협업이 필요했어요.", tags: ["팀플많음"] },
  { text: () => "출석을 꼼꼼히 체크하시는 편이라 결석하면 감점이 큽니다.", tags: ["출석중요"] },
  { text: () => "질문하면 성심껏 답변해주셔서 좋았습니다.", tags: ["교수님친절"] },
]

const CLOSINGS = [
  (topic: string) => `${topic} 쪽 진로를 생각한다면 꼭 들어보길 추천합니다.`,
  () => "반도체 관련 심화 전공을 준비하는 학생들에게 유익한 수업이에요.",
  () => "전반적으로 만족스러운 수업이었습니다.",
  () => "다음 학기에도 같은 교수님이 강의하시면 또 듣고 싶을 정도예요.",
  () => "기초를 먼저 다지고 듣는 걸 추천합니다.",
]

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function buildReviews(courseName: string, professor: string, topic: string) {
  const p = professor || "담당"
  return Array.from({ length: 5 }, (_, i) => {
    const opener = pick(OPENERS, i + courseName.length)(p, topic)
    const middle = pick(MIDDLES, i * 3 + courseName.length)
    const closing = pick(CLOSINGS, i + 2)(topic)
    const rating = pick([5, 4, 4, 3, 4, 5, 3], i + professor.length)
    return {
      rating,
      body: `${opener} ${middle.text(topic)} ${closing}`,
      hashtags: middle.tags,
    }
  })
}

async function main() {
  const byCode = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, professor: courses.professor, semester: courses.semester })
    .from(courses)
    .where(inArray(courses.code, TARGET_CODES))
  const byName = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, professor: courses.professor, semester: courses.semester })
    .from(courses)
    .where(inArray(courses.name, TARGET_NAMES_NO_CODE))

  const all = [...byCode, ...byName]
  const byKey = new Map<string, (typeof all)[number]>()
  for (const r of all) {
    const key = r.code ?? r.name
    const existing = byKey.get(key)
    if (!existing || r.semester > existing.semester) byKey.set(key, r)
  }

  const keys = [...TARGET_CODES, ...TARGET_NAMES_NO_CODE]
  for (const key of keys) {
    const course = byKey.get(key)
    if (!course) {
      console.error(`건너뜀: ${key} — courses 테이블에서 찾지 못함`)
      continue
    }
    const topic = TOPIC[key]
    const seeds = buildReviews(course.name, course.professor ?? "", topic)

    await db.insert(reviews).values(
      seeds.map((s, i) => ({
        courseId: course.id,
        authorAnonId: `dummy-semiconductor-${key}-${i}`,
        rating: s.rating,
        body: s.body,
        hashtags: s.hashtags,
        semester: course.semester,
        isFiltered: false,
      })),
    )
    console.log(`리뷰 ${seeds.length}건 등록: ${course.name} (${key})`)

    try {
      const summaryText = await generateCourseSummary(
        course.name,
        course.professor,
        seeds.map((s) => ({ rating: s.rating, body: s.body, hashtags: s.hashtags })),
      )
      if (summaryText) {
        await db
          .insert(summaries)
          .values({ courseId: course.id, body: summaryText, basedReviewCount: seeds.length })
          .onConflictDoUpdate({
            target: summaries.courseId,
            set: { body: summaryText, basedReviewCount: seeds.length, generatedAt: new Date() },
          })
        console.log(`  AI 요약 생성 완료`)
      }
    } catch (err) {
      console.error(`  AI 요약 생성 실패 (${key}):`, err)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
