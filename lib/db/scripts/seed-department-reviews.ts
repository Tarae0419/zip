// 특정 학과의 모든 과목에 더미 수강평을 채운다 (seed-bulk-reviews.ts와 같은 프로필/템플릿 로직을
// 재사용하되, "인기순 상위 N개" 대신 "그 학과 소속 과목 전체"를 대상으로 한다).
// DEPARTMENT를 바꿔서 다른 학과에도 재사용할 수 있다.
// 재실행해도 안전 — anon_id 접두사(sample-dept-<학과>-)가 이미 붙은 과목은 건너뛴다.
// 실행: pnpm db:seed-department-reviews
import { and, eq, inArray } from "drizzle-orm"
import { db } from "../client"
import { courses, reviews, summaries } from "../schema"
import { getCanonicalCourseId, getSiblingCourseIds } from "../queries"
import { generateCourseSummary } from "../../ai/summary"

const DEPARTMENT = "전자공학부"
const SAMPLE_ANON_PREFIX = `sample-dept-${DEPARTMENT}-`
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

// 결정적 의사난수 — 재실행 시 같은 과목엔 같은 패턴을 주기 위함.
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
      const count = 8 + Math.floor(rand() * 4)
      return Array.from({ length: count }, () => ({
        rating: rand() < 0.75 ? 4 + Math.round(rand()) : 2 + Math.round(rand()),
        createdAt: daysAgo(Math.floor(rand() * 25), rand),
      }))
    }
    case "old-faithful": {
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
      const count = 4 + Math.floor(rand() * 3)
      return Array.from({ length: count }, () => ({
        rating: rand() < 0.85 ? 5 : 4,
        createdAt: daysAgo(Math.floor(rand() * 40), rand),
      }))
    }
    case "mixed":
    default: {
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
    })
    .from(courses)
    .where(and(eq(courses.department, DEPARTMENT), eq(courses.isPublic, true)))
    .orderBy(courses.name)

  // 같은 과목명(코드)이 여러 학기/분반 row로 중복될 수 있어 하나만 남긴다 — 학기 문자열이 큰(최신) row 우선.
  const bestByKey = new Map<string, (typeof candidates)[number]>()
  for (const c of candidates) {
    const key = c.code ?? c.name
    const existing = bestByKey.get(key)
    if (!existing || c.semester > existing.semester) bestByKey.set(key, c)
  }
  const targets = [...bestByKey.values()]

  console.log(`${DEPARTMENT} 소속 과목 ${targets.length}개에 더미 리뷰를 시딩합니다.`)

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
