// F1 데모용 대량 더미 수강평 시딩 — "인기 과목" 랭킹 기준(평균 평점 vs 리뷰 증가량) 논의를 위해
// createdAt을 최근 ~70일에 걸쳐 의도적으로 다르게 흩뿌린다:
//   burst        최근 0~25일에 리뷰가 몰림 → "최근 한 달 리뷰 증가량" 기준에서 상위로 뜸
//   old-faithful 리뷰는 많지만 대부분 35~70일 전 → "이번 달" 창에서는 안 뜨는 대조군
//   small-n-high 리뷰 4~6개뿐이지만 평균 평점이 매우 높음 → "이번 달 평균 평점"만 볼 때 표본이 작아도
//                상위로 뜨는 문제(적은 리뷰 수의 착시)를 보여주는 대조군
//   mixed        보통 개수, 평점도 고르게 섞여 60일에 걸쳐 분포 → 기준선
// 재실행해도 안전 — anon_id 접두사(sample-bulk-)가 이미 붙은 과목은 건너뛴다.
// 실행: pnpm db:seed-bulk-reviews
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "../client"
import { courses, reviews, summaries } from "../schema"
import { getCanonicalCourseId, getSiblingCourseIds } from "../queries"
import { generateCourseSummary } from "../../ai/summary"

const SAMPLE_ANON_PREFIX = "sample-bulk-"
const TARGET_COURSE_COUNT = 40
const MIN_REVIEWS_FOR_SUMMARY = 5

type Profile = "burst" | "old-faithful" | "small-n-high" | "mixed"

const PROFILES: Profile[] = ["burst", "old-faithful", "small-n-high", "mixed"]

type Template = { body: (name: string) => string; hashtags: string[] }

const POSITIVE_TEMPLATES: Template[] = [
  { body: (n) => `${n} 수업 정말 유익했어요. 교수님 설명도 명확하고 알차게 잘 배웠습니다.`, hashtags: ["꿀강의", "교수님친절"] },
  { body: () => "생각보다 부담 없이 들을 수 있는 과목이었어요. 팀플도 없고 편하게 학점 챙기기 좋았습니다.", hashtags: ["널널함", "꿀강의"] },
  { body: (n) => `${n}가 앞으로 진로에 도움이 될 만한 내용이 많아서 만족스러웠습니다.`, hashtags: ["실무중심"] },
  { body: () => "교수님이 질문에 성실하게 답해주셔서 이해하는 데 큰 도움이 됐어요.", hashtags: ["교수님친절", "실무중심"] },
  { body: (n) => `${n} 강의력이 정말 좋으셔서 어려운 내용도 쉽게 이해됐어요. 강력 추천합니다.`, hashtags: ["꿀강의", "교수님친절"] },
  { body: () => "과제나 시험 부담이 크지 않아서 다른 전공 공부할 시간도 확보할 수 있었어요.", hashtags: ["널널함"] },
]

const NEGATIVE_TEMPLATES: Template[] = [
  { body: () => "생각보다 과제랑 시험 부담이 커서 힘들었던 과목이에요.", hashtags: ["과제많음", "시험어려움"] },
  { body: (n) => `${n} 진도가 빨라서 따라가기 벅찼습니다. 기초가 없으면 어려울 수 있어요.`, hashtags: ["시험어려움", "재수강비추"] },
  { body: () => "학점이 후하게 나오는 편은 아니라서 신중하게 고민하고 듣는 걸 추천해요.", hashtags: ["과제많음", "출석중요"] },
  { body: () => "출석 체크가 엄격한 편이라 매주 부담스러웠습니다.", hashtags: ["출석중요", "재수강비추"] },
  { body: (n) => `${n} 팀플이 많아서 조원 잘못 만나면 고생합니다. 팀플 싫어하면 비추천이에요.`, hashtags: ["팀플많음", "재수강비추"] },
]

const NEUTRAL_TEMPLATES: Template[] = [
  { body: (n) => `${n}는 무난하게 들을만한 과목입니다. 특별히 힘들지도, 특별히 꿀강의도 아니었어요.`, hashtags: ["출석중요"] },
  { body: () => "호불호가 갈릴 것 같아요. 저는 나쁘지 않았지만 사람마다 평가가 다를 듯합니다.", hashtags: ["시험어려움"] },
]

function pickTemplate(rating: number, seed: number): Template {
  const pool = rating >= 4 ? POSITIVE_TEMPLATES : rating <= 2 ? NEGATIVE_TEMPLATES : NEUTRAL_TEMPLATES
  return pool[seed % pool.length]
}

// 결정적 의사난수 — 재실행 시 같은 과목엔 같은 패턴을 주기 위함 (내용 자체는 idempotency 체크에 안 쓰이지만 재현성 있게).
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function daysAgo(days: number, rand: () => number): Date {
  const ms = days * 24 * 60 * 60 * 1000 + Math.floor(rand() * 24 * 60 * 60 * 1000)
  return new Date(Date.now() - ms)
}

/** 프로필별로 (rating, createdAt) 목록을 만든다. */
function buildPlan(profile: Profile, rand: () => number): { rating: number; createdAt: Date }[] {
  switch (profile) {
    case "burst": {
      // 최근 0~25일에 몰린 8~11개, 평점은 대체로 긍정.
      const count = 8 + Math.floor(rand() * 4)
      return Array.from({ length: count }, () => ({
        rating: rand() < 0.75 ? 4 + Math.round(rand()) : 2 + Math.round(rand()),
        createdAt: daysAgo(Math.floor(rand() * 25), rand),
      }))
    }
    case "old-faithful": {
      // 총 9~13개, 대부분 35~70일 전(이번 달 창 밖), 최근 것은 1~2개만.
      const oldCount = 8 + Math.floor(rand() * 4)
      const recentCount = 1 + Math.floor(rand() * 2)
      const plan = Array.from({ length: oldCount }, () => ({
        rating: rand() < 0.7 ? 4 + Math.round(rand()) : 3,
        createdAt: daysAgo(35 + Math.floor(rand() * 35), rand),
      }))
      for (let i = 0; i < recentCount; i++) {
        plan.push({ rating: 3 + Math.round(rand() * 2), createdAt: daysAgo(Math.floor(rand() * 25), rand) })
      }
      return plan
    }
    case "small-n-high": {
      // 4~6개뿐이지만 거의 만점, 최근 40일 내 분포.
      const count = 4 + Math.floor(rand() * 3)
      return Array.from({ length: count }, () => ({
        rating: rand() < 0.85 ? 5 : 4,
        createdAt: daysAgo(Math.floor(rand() * 40), rand),
      }))
    }
    case "mixed":
    default: {
      // 6~9개, 평점 고르게 섞임, 60일에 걸쳐 균등 분포.
      const count = 6 + Math.floor(rand() * 4)
      return Array.from({ length: count }, () => ({
        rating: 2 + Math.floor(rand() * 4),
        createdAt: daysAgo(Math.floor(rand() * 60), rand),
      }))
    }
  }
}

async function main() {
  const candidates = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      professor: courses.professor,
      semester: courses.semester,
      enrolledCount: courses.enrolledCount,
    })
    .from(courses)
    .where(eq(courses.isPublic, true))
    .orderBy(desc(courses.enrolledCount))
    .limit(300)

  // 같은 과목명(코드)이 여러 학기/분반 row로 중복될 수 있어 하나만 남긴다.
  const seen = new Set<string>()
  const targets: typeof candidates = []
  for (const c of candidates) {
    const key = c.code ?? c.name
    if (seen.has(key)) continue
    seen.add(key)
    targets.push(c)
    if (targets.length >= TARGET_COURSE_COUNT) break
  }

  console.log(`대상 과목 ${targets.length}개에 더미 리뷰를 시딩합니다.`)

  for (let i = 0; i < targets.length; i++) {
    const course = targets[i]
    const siblingIds = await getSiblingCourseIds(course)

    const [already] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.authorAnonId, `${SAMPLE_ANON_PREFIX}${course.code ?? course.id}-0`)))
      .limit(1)
    if (already) {
      console.log(`이미 시딩됨, 스킵: ${course.name}`)
      continue
    }

    const profile = PROFILES[i % PROFILES.length]
    const seedNum = Math.abs(
      [...(course.code ?? course.name)].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) | 0, 5381),
    )
    const rand = mulberry32(seedNum)
    const plan = buildPlan(profile, rand)

    const values = plan.map((p, idx) => {
      const template = pickTemplate(p.rating, seedNum + idx)
      return {
        courseId: course.id,
        authorAnonId: `${SAMPLE_ANON_PREFIX}${course.code ?? course.id}-${idx}`,
        rating: p.rating,
        body: template.body(course.name),
        hashtags: template.hashtags,
        semester: course.semester,
        isFiltered: false,
        createdAt: p.createdAt,
      }
    })

    await db.insert(reviews).values(values)
    console.log(`[${profile}] 리뷰 ${values.length}건 삽입: ${course.name} (${course.professor ?? "교수미정"})`)

    // 실제 흐름처럼 canonical row 기준으로 "현재 유효 리뷰 전체"를 다시 읽어 요약을 생성한다
    // (다른 시딩 스크립트가 이미 넣어둔 리뷰가 있을 수도 있으므로 이번 배치만 보고 요약하지 않는다).
    const validReviews = await db
      .select({ rating: reviews.rating, body: reviews.body, hashtags: reviews.hashtags })
      .from(reviews)
      .where(and(inArray(reviews.courseId, siblingIds), eq(reviews.isFiltered, false)))

    if (validReviews.length >= MIN_REVIEWS_FOR_SUMMARY) {
      const canonicalId = await getCanonicalCourseId(siblingIds)
      if (canonicalId) {
        try {
          const summaryText = await generateCourseSummary(
            course.name,
            course.professor,
            validReviews.map((r) => ({ rating: r.rating, body: r.body, hashtags: (r.hashtags as string[]) ?? [] })),
          )
          if (summaryText) {
            await db
              .insert(summaries)
              .values({ courseId: canonicalId, body: summaryText, basedReviewCount: validReviews.length })
              .onConflictDoUpdate({
                target: summaries.courseId,
                set: { body: summaryText, basedReviewCount: validReviews.length, generatedAt: new Date() },
              })
            console.log(`  → AI 요약 갱신 (총 ${validReviews.length}개 리뷰 기반)`)
          }
        } catch (err) {
          console.error(`  → AI 요약 생성 실패 (${course.name}):`, err)
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
