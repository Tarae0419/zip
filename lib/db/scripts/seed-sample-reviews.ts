// F1 데모/테스트용 더미 수강평 시딩 — 좋은 평/나쁜 평을 섞어 3개 과목에 채운다.
// 실 리뷰 흐름(lib/actions/reviews.ts)과 동일하게 5개 이상 쌓이면 AI 요약도 함께 생성한다.
// 재실행해도 안전 — anon_id가 이미 리뷰를 남긴 과목이면 스킵한다.
// 실행: pnpm db:seed-sample-reviews
import { and, eq, inArray } from "drizzle-orm"
import { db } from "../client"
import { courses, reviews, summaries } from "../schema"
import { getCanonicalCourseId, getSiblingCourseIds } from "../queries"
import { generateCourseSummary } from "../../ai/summary"

const SAMPLE_ANON_PREFIX = "sample-reviewer-"

type SampleReview = { rating: number; body: string; hashtags: string[] }

type CourseSeed = { code: string; reviews: SampleReview[] }

// predefinedReviewTags(lib/mock-data.ts)에 있는 태그만 사용한다.
const COURSE_SEEDS: CourseSeed[] = [
  {
    code: "UCAI006", // 자료구조 — 대체로 긍정적인 평가
    reviews: [
      { rating: 5, hashtags: ["꿀강의", "교수님친절"], body: "교수님이 정말 친절하시고 질문하면 예시를 들어서 차근차근 설명해주세요. 자료구조가 어려운 과목인데 덕분에 재밌게 들었습니다. 강력 추천!" },
      { rating: 4, hashtags: ["실무중심", "과제많음"], body: "실습 위주라 코딩 실력이 확실히 늘어요. 다만 매주 과제가 있어서 시간 투자는 꽤 필요합니다. 그래도 배우는 건 확실히 많아요." },
      { rating: 5, hashtags: ["꿀강의"], body: "개념 설명이 명확하고 강의 자료도 꼼꼼해서 혼자 복습하기도 좋았습니다." },
      { rating: 3, hashtags: ["과제많음", "출석중요"], body: "출석을 꼼꼼히 부르셔서 지각하면 눈치 보입니다. 과제도 매주 있어서 부담스러웠지만 시험은 그래도 무난했어요." },
      { rating: 2, hashtags: ["재수강비추", "시험어려움"], body: "이론 수업 진도가 너무 빨라서 따라가기 벅찼습니다. 시험 문제도 수업 내용보다 어렵게 나온 느낌이라 재수강은 별로 추천 안 해요." },
      { rating: 5, hashtags: ["교수님친절", "실무중심"], body: "취업 준비하면서 정말 도움 많이 됐습니다. 실제 코딩테스트에 나오는 자료구조 개념을 다 다뤄줘서 좋았어요." },
    ],
  },
  {
    code: "UELC012", // 전자기학 1 — 대체로 부정적인 평가
    reviews: [
      { rating: 2, hashtags: ["시험어려움", "재수강비추"], body: "내용 자체가 어려운 과목인데 시험도 극악으로 어렵게 냅니다. 평균 점수가 너무 낮아서 학점 잘 받기 힘들어요. 재수강 비추천합니다." },
      { rating: 2, hashtags: ["과제많음", "시험어려움"], body: "매주 과제에 쪽지시험까지 있어서 부담이 정말 큽니다. 전자기학이 원래 어려운 과목이긴 하지만 이 정도면 너무 빡세요." },
      { rating: 3, hashtags: ["시험어려움"], body: "설명은 나쁘지 않은데 시험이 수업 내용보다 훨씬 어렵게 나와서 당황했습니다. 기초가 탄탄해야 따라갈 수 있어요." },
      { rating: 5, hashtags: ["교수님친절", "실무중심"], body: "생각보다 좋았습니다. 질문하면 성심성의껏 답해주시고, 어려운 개념도 그림으로 잘 설명해주세요. 시험이 어렵다는 평이 많아서 걱정했는데 수업만 잘 따라가면 괜찮았어요." },
      { rating: 2, hashtags: ["재수강비추", "과제많음"], body: "전자기학 자체가 어려운데 과제량까지 많아서 정말 힘들었습니다. 다음에 듣는 분들은 각오하고 들으세요." },
    ],
  },
  {
    code: "UCAI001", // 선형대수학(컴퓨터인공지능학부) — 호불호가 뚜렷하게 갈리는 평가
    reviews: [
      { rating: 5, hashtags: ["꿀강의", "널널함"], body: "개념 위주로 차근차근 나가서 부담 없이 들을 수 있었어요. 팀플도 없고 과제도 적어서 꿀강의라고 부를만 합니다." },
      { rating: 1, hashtags: ["시험어려움", "재수강비추"], body: "수업은 쉬운데 시험 난이도가 수업이랑 완전 딴판이었어요. 배운 것만 믿고 있다가 시험에서 완전히 무너졌습니다." },
      { rating: 5, hashtags: ["교수님친절", "꿀강의"], body: "교수님 강의 정말 좋아요. 어려운 개념도 비유를 들어서 이해하기 쉽게 설명해주십니다." },
      { rating: 2, hashtags: ["시험어려움", "과제많음"], body: "과제도 은근히 많고 시험도 생각보다 어려웠습니다. 수학 기초가 없으면 힘들어요." },
      { rating: 4, hashtags: ["실무중심"], body: "선형대수는 나중에 AI 공부할 때 진짜 많이 쓰이는데 그 연결을 잘 짚어주셔서 좋았습니다." },
      { rating: 1, hashtags: ["재수강비추", "출석중요"], body: "출석 체크가 엄격한데 시험 난이도까지 높아서 이중고였습니다. 학점 잘 받기 어려운 과목이에요." },
    ],
  },
]

async function main() {
  for (const seed of COURSE_SEEDS) {
    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name, professor: courses.professor, semester: courses.semester })
      .from(courses)
      .where(eq(courses.code, seed.code))
      .limit(1)

    if (!course) {
      console.warn(`스킵: 학수번호 ${seed.code}에 해당하는 과목을 찾지 못함`)
      continue
    }

    const siblingIds = await getSiblingCourseIds(course)
    const sampleAnonIds = seed.reviews.map((_, i) => `${SAMPLE_ANON_PREFIX}${seed.code}-${i}`)
    const [already] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(inArray(reviews.courseId, siblingIds), inArray(reviews.authorAnonId, sampleAnonIds)))
      .limit(1)
    if (already) {
      console.log(`이미 시딩됨, 스킵: ${course.name} (${seed.code})`)
      continue
    }

    for (let i = 0; i < seed.reviews.length; i++) {
      const r = seed.reviews[i]
      await db.insert(reviews).values({
        courseId: course.id,
        authorAnonId: sampleAnonIds[i],
        rating: r.rating,
        body: r.body,
        hashtags: r.hashtags,
        semester: course.semester,
        isFiltered: false,
      })
    }
    console.log(`리뷰 ${seed.reviews.length}건 삽입: ${course.name} (${course.professor}, ${seed.code})`)

    // 실 앱과 동일하게 리뷰 5개 이상이면 AI 요약도 생성해서 캐싱한다.
    if (seed.reviews.length >= 5) {
      const canonicalId = await getCanonicalCourseId(siblingIds)
      if (canonicalId) {
        const summaryText = await generateCourseSummary(
          course.name,
          course.professor,
          seed.reviews.map((r) => ({ rating: r.rating, body: r.body, hashtags: r.hashtags })),
        )
        if (summaryText) {
          await db
            .insert(summaries)
            .values({ courseId: canonicalId, body: summaryText, basedReviewCount: seed.reviews.length })
            .onConflictDoUpdate({ target: summaries.courseId, set: { body: summaryText, basedReviewCount: seed.reviews.length } })
          console.log(`  → AI 요약 생성 완료: ${summaryText.slice(0, 40)}...`)
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
