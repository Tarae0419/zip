// 홈 "이번 학기 인기 과목"(getPopularCourses, 수강인원 순)이 실제로 평점·리뷰·해시태그를 보여줄 수 있도록,
// 실제 수강인원 상위 과목들에 더미 수강평을 채운다. 재실행해도 안전 — 이미 시딩된 과목은 건너뛴다.
// 실행: pnpm db:seed-popular-reviews
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "../client"
import { courses, reviews, summaries } from "../schema"
import { getCanonicalCourseId, getSiblingCourseIds } from "../queries"
import { generateCourseSummary } from "../../ai/summary"

const SAMPLE_ANON_PREFIX = "sample-popular-"
const TOP_N = 12

// predefinedReviewTags(lib/mock-data.ts) 안에서만 고른다.
const POSITIVE_TEMPLATES: { body: (name: string) => string; hashtags: string[] }[] = [
  { body: (n) => `${n} 수업 정말 유익했어요. 교수님 설명도 명확하고 알차게 잘 배웠습니다.`, hashtags: ["꿀강의", "교수님친절"] },
  { body: () => "생각보다 부담 없이 들을 수 있는 과목이었어요. 팀플도 없고 편하게 학점 챙기기 좋았습니다.", hashtags: ["널널함", "꿀강의"] },
  { body: (n) => `${n}가 앞으로 진로에 도움이 될 만한 내용이 많아서 만족스러웠습니다.`, hashtags: ["실무중심"] },
  { body: () => "교수님이 질문에 성실하게 답해주셔서 이해하는 데 큰 도움이 됐어요.", hashtags: ["교수님친절", "실무중심"] },
]

const NEGATIVE_TEMPLATES: { body: (name: string) => string; hashtags: string[] }[] = [
  { body: () => "생각보다 과제랑 시험 부담이 커서 힘들었던 과목이에요.", hashtags: ["과제많음", "시험어려움"] },
  { body: (n) => `${n} 진도가 빨라서 따라가기 벅찼습니다. 기초가 없으면 어려울 수 있어요.`, hashtags: ["시험어려움", "재수강비추"] },
  { body: () => "학점이 후하게 나오는 편은 아니라서 신중하게 고민하고 듣는 걸 추천해요.", hashtags: ["과제많음", "출석중요"] },
  { body: () => "출석 체크가 엄격한 편이라 매주 부담스러웠습니다.", hashtags: ["출석중요", "재수강비추"] },
]

const NEUTRAL_TEMPLATES: { body: (name: string) => string; hashtags: string[] }[] = [
  { body: (n) => `${n}는 무난하게 들을만한 과목입니다. 특별히 힘들지도, 특별히 꿀강의도 아니었어요.`, hashtags: ["출석중요"] },
]

// 과목마다 감상 성향을 다르게 줘서(대체로 긍정 / 혼합 / 대체로 부정) 화면이 획일적으로 보이지 않게 한다.
const SENTIMENT_PATTERNS: number[][] = [
  [5, 4, 5, 5, 4], // 대체로 긍정
  [4, 2, 5, 3, 4], // 약간 혼합, 긍정 우세
  [3, 2, 4, 2, 5], // 호불호
  [2, 2, 3, 4, 2], // 약간 혼합, 부정 우세
]

function pickTemplate(rating: number, index: number) {
  const pool = rating >= 4 ? POSITIVE_TEMPLATES : rating <= 2 ? NEGATIVE_TEMPLATES : NEUTRAL_TEMPLATES
  return pool[index % pool.length]
}

async function main() {
  const topCourses = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, professor: courses.professor, semester: courses.semester })
    .from(courses)
    .where(eq(courses.isPublic, true))
    .orderBy(desc(courses.enrolledCount))
    .limit(TOP_N)

  for (let courseIndex = 0; courseIndex < topCourses.length; courseIndex++) {
    const course = topCourses[courseIndex]
    const siblingIds = await getSiblingCourseIds(course)

    const pattern = SENTIMENT_PATTERNS[courseIndex % SENTIMENT_PATTERNS.length]
    const sampleAnonIds = pattern.map((_, i) => `${SAMPLE_ANON_PREFIX}${course.code ?? course.id}-${i}`)

    const [already] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(inArray(reviews.courseId, siblingIds), inArray(reviews.authorAnonId, sampleAnonIds)))
      .limit(1)
    if (already) {
      console.log(`이미 시딩됨, 스킵: ${course.name}`)
      continue
    }

    const sampleReviews = pattern.map((rating, i) => {
      const template = pickTemplate(rating, i + courseIndex)
      return { rating, body: template.body(course.name), hashtags: template.hashtags }
    })

    for (let i = 0; i < sampleReviews.length; i++) {
      const r = sampleReviews[i]
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
    console.log(`리뷰 ${sampleReviews.length}건 삽입: ${course.name} (${course.professor})`)

    if (sampleReviews.length >= 5) {
      const canonicalId = await getCanonicalCourseId(siblingIds)
      if (canonicalId) {
        const summaryText = await generateCourseSummary(
          course.name,
          course.professor,
          sampleReviews.map((r) => ({ rating: r.rating, body: r.body, hashtags: r.hashtags })),
        )
        if (summaryText) {
          await db
            .insert(summaries)
            .values({ courseId: canonicalId, body: summaryText, basedReviewCount: sampleReviews.length })
            .onConflictDoUpdate({ target: summaries.courseId, set: { body: summaryText, basedReviewCount: sampleReviews.length } })
          console.log(`  → AI 요약 생성 완료`)
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
