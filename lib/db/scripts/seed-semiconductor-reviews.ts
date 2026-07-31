// 반도체 관련 과목들의 F1(수강평·해시태그·AI 요약) 시연/테스트용 더미 리뷰 시딩.
// 실제 학생 데이터가 아니다 — 각 과목마다 6개씩 리뷰를 넣어 AI 요약 최소 기준(5건)을 넘긴다.
// 재실행 시 중복 삽입을 피하려면 먼저 DB에서 해당 과목의 더미 리뷰(authorAnonId LIKE 'dummy-%')를
// 지우고 다시 실행할 것 — 이 스크립트 자체는 idempotent하지 않다.
// 실행: pnpm exec tsx --env-file=.env.local lib/db/scripts/seed-semiconductor-reviews.ts
import { db } from "../client"
import { courses, reviews } from "../schema"
import { generateCourseSummary } from "../../ai/summary"
import { inArray } from "drizzle-orm"
import { summaries } from "../schema"

type ReviewSeed = { rating: number; body: string; hashtags: string[] }

const COURSE_REVIEWS: Record<string, ReviewSeed[]> = {
  UELC004: [
    // 반도체소자 (전자공학부, 박철헌)
    { rating: 5, body: "박철헌 교수님이 반도체 소자 동작 원리를 처음부터 차근차근 짚어주셔서 전공필수 중에 제일 이해가 잘 됐어요. 다이오드, MOSFET 동작을 물리적으로 이해하고 나니 이후 회로 과목들이 훨씬 수월해졌습니다.", hashtags: ["교수님친절", "실무중심"] },
    { rating: 4, body: "내용 자체가 어렵진 않은데 중간·기말 시험 범위가 넓어서 벼락치기로는 안 통해요. 매주 진도를 따라가면서 공식 유도 과정을 꼭 이해하고 넘어가야 합니다.", hashtags: ["시험어려움"] },
    { rating: 3, body: "수업은 무난했는데 과제가 생각보다 많았어요. 매주 문제풀이 과제 제출이라 시간 관리가 필요합니다. 그래도 채점은 꼼꼼하게 피드백 해주십니다.", hashtags: ["과제많음", "교수님친절"] },
    { rating: 5, body: "전공필수라 어쩔 수 없이 들었는데 생각보다 재밌었습니다. 밴드갭이나 캐리어 농도 계산이 처음엔 낯설어도 문제를 여러 번 풀다 보면 감이 잡혀요.", hashtags: ["실무중심"] },
    { rating: 4, body: "출석은 크게 신경 안 쓰시는데 대신 쪽지시험을 자주 봐서 결국 매시간 집중해야 해요. 재수강생도 꽤 있던데 한 번에 듣는 걸 추천합니다.", hashtags: ["출석중요"] },
    { rating: 4, body: "반도체 쪽 진로 생각하는 사람이면 꼭 들어야 하는 과목이에요. 이론 위주라 실습은 없지만 이후 반도체공정, 소자공학 등을 들을 때 기초가 탄탄해집니다.", hashtags: ["실무중심"] },
  ],
  UELC082: [
    // 반도체물리전자 (전자공학부, 김기현)
    { rating: 4, body: "김기현 교수님 강의력이 좋으셔서 양자역학 기초부터 반도체 물성까지 흐름이 잘 이어집니다. 다만 수학적으로 유도하는 부분이 많아 선형대수·미분방정식 복습이 필요해요.", hashtags: ["교수님친절"] },
    { rating: 3, body: "내용이 꽤 어려운 편입니다. 슈뢰딩거 방정식부터 시작해서 밴드 이론까지 다루는데, 물리 배경지식이 부족하면 따라가기 벅찰 수 있어요.", hashtags: ["시험어려움"] },
    { rating: 5, body: "전자공학부에서 반도체 소자를 제대로 이해하고 싶다면 이 과목이 핵심입니다. 과제는 많지 않지만 시험 문제가 응용력을 요구해서 개념 이해가 중요해요.", hashtags: ["실무중심"] },
    { rating: 4, body: "팀플 없이 개인 과제와 시험으로만 평가돼서 좋았습니다. 강의자료가 잘 정리되어 있어 복습하기 편해요.", hashtags: ["교수님친절"] },
    { rating: 3, body: "중간고사 난이도가 예상보다 높았어요. 공식을 암기하는 것보다 유도 과정을 이해해야 풀 수 있는 문제가 많습니다.", hashtags: ["시험어려움"] },
    { rating: 4, body: "반도체과학기술학과나 전자재료 쪽 진로를 생각한다면 꼭 들으세요. 다소 빡빡하지만 얻어가는 게 많은 과목입니다.", hashtags: ["실무중심", "출석중요"] },
  ],
  UELC063: [
    // 반도체디스플레이공학 (전자공학부, 이지훈)
    { rating: 5, body: "이지훈 교수님이 디스플레이 산업 최신 동향을 많이 소개해주셔서 흥미로웠어요. LCD, OLED 구조 차이부터 최근 마이크로 LED까지 폭넓게 다룹니다.", hashtags: ["실무중심", "교수님친절"] },
    { rating: 4, body: "전공선택치고 과제가 좀 있는 편인데, 실제 디스플레이 패널 스펙을 분석하는 과제라 재밌었습니다. 발표 수업도 한 번 있어요.", hashtags: ["과제많음", "실무중심"] },
    { rating: 4, body: "반도체 소자 기초를 먼저 듣고 오면 이해가 훨씬 잘 됩니다. 선수과목 개념이 없어도 들을 수는 있지만 초반 진도가 좀 빠르게 느껴질 수 있어요.", hashtags: [] },
    { rating: 3, body: "시험보다는 과제와 발표 비중이 높은 수업이에요. 팀플이 한 번 있는데 조원 편차가 있어서 아쉬웠습니다.", hashtags: ["팀플많음"] },
    { rating: 5, body: "디스플레이 업계 취업 준비하는 학생들한테 특히 추천합니다. 현직 트렌드를 반영한 사례 위주 강의라 실무 감각을 익히기 좋아요.", hashtags: ["실무중심"] },
    { rating: 4, body: "출석 체크를 꼼꼼히 하시는 편이라 결석하면 감점이 꽤 큽니다. 대신 강의 자체는 널널한 분위기예요.", hashtags: ["출석중요"] },
  ],
  USEM043: [
    // 반도체공학개론 (반도체과학기술학과, 허근)
    { rating: 5, body: "허근 교수님이 반도체 산업 전반을 처음 접하는 학생 눈높이에 맞춰 설명해주셔서 입문용으로 최고입니다. 공정, 소자, 패키징까지 큰 그림을 잡을 수 있어요.", hashtags: ["교수님친절", "꿀강의"] },
    { rating: 4, body: "1학년도 들을 수 있을 정도로 진입장벽이 낮은 편입니다. 다만 나중에 심화 과목을 들으려면 이 과목에서 나온 용어들은 확실히 익혀두는 게 좋아요.", hashtags: ["꿀강의"] },
    { rating: 4, body: "퀴즈가 잦은 편이라 매주 예습·복습이 필요합니다. 그래도 시험 자체는 강의 내용 위주라 크게 어렵지 않았어요.", hashtags: ["출석중요"] },
    { rating: 5, body: "반도체과학기술학과 전공 진입 전에 듣기 딱 좋은 개론 수업입니다. 현장 견학이나 산업체 특강도 종종 있어서 유익했어요.", hashtags: ["실무중심"] },
    { rating: 3, body: "개론 수업이다 보니 각 주제를 깊게 파고들진 않아요. 얕고 넓게 배운다는 느낌이라 더 깊은 내용은 후속 전공 과목에서 채워야 합니다.", hashtags: [] },
    { rating: 4, body: "팀 프로젝트로 반도체 기업 하나를 조사해서 발표하는 과제가 있었는데 생각보다 재밌었어요. 조별 과제긴 하지만 부담스러운 정도는 아니었습니다.", hashtags: ["팀플많음"] },
  ],
  USEM062: [
    // 반도체소자 1 (반도체과학기술학과, 심규환)
    { rating: 3, body: "심규환 교수님 수업은 내용이 탄탄한데 그만큼 시험도 어렵게 나옵니다. pn접합, MOSFET 동작 원리를 수식으로 다 이해해야 풀 수 있는 문제가 많아요.", hashtags: ["시험어려움"] },
    { rating: 4, body: "전공 필수급으로 중요한 과목이라 다들 열심히 듣더라구요. 질문하면 답변을 성심껏 해주셔서 좋았습니다.", hashtags: ["교수님친절"] },
    { rating: 4, body: "과제가 매주는 아니지만 나올 때마다 계산량이 꽤 됩니다. 스터디 짜서 같이 푸는 걸 추천해요.", hashtags: ["과제많음"] },
    { rating: 2, body: "기초가 없으면 초반부터 힘들 수 있어요. 반도체공학개론이나 물리전자 쪽을 먼저 듣고 오는 게 훨씬 낫습니다.", hashtags: ["시험어려움"] },
    { rating: 4, body: "반도체 소자 쪽 대학원 진학이나 취업 생각하면 필수로 들어야 하는 과목이라고 생각해요. 어렵지만 그만큼 남는 게 많습니다.", hashtags: ["실무중심"] },
    { rating: 3, body: "재수강하는 학생이 꽤 있었어요. 한 번에 좋은 학점 받고 싶으면 예습을 충분히 하고 수업 들어가는 걸 추천합니다.", hashtags: ["재수강비추", "시험어려움"] },
  ],
  USEM047: [
    // 반도체공정 (반도체과학기술학과, 심규환)
    { rating: 4, body: "웨이퍼 제작부터 포토리소그래피, 식각, 증착까지 실제 반도체 공정 흐름을 순서대로 배웁니다. 그림 자료가 많아서 이해하기 수월했어요.", hashtags: ["실무중심"] },
    { rating: 5, body: "클린룸 견학을 다녀온 게 정말 좋은 경험이었습니다. 이론으로만 배우던 공정을 직접 눈으로 볼 수 있어서 훨씬 와닿았어요.", hashtags: ["실무중심", "교수님친절"] },
    { rating: 3, body: "공정 단계가 워낙 많아서 암기할 내용이 상당합니다. 그림과 공정 순서를 세트로 외워야 시험을 잘 볼 수 있어요.", hashtags: ["시험어려움"] },
    { rating: 4, body: "팀별로 특정 공정 단계를 조사해서 발표하는 과제가 있었어요. 조원들과 협업이 필요하지만 부담은 크지 않았습니다.", hashtags: ["팀플많음"] },
    { rating: 4, body: "반도체 공정 엔지니어를 목표로 한다면 꼭 들어야 하는 과목입니다. 최신 미세공정 트렌드도 같이 다뤄주셔서 유익했어요.", hashtags: ["실무중심"] },
    { rating: 3, body: "출석은 크게 안 보시지만 중간·기말 비중이 높아서 시험 대비를 확실히 해야 합니다.", hashtags: ["시험어려움"] },
  ],
  UEME078: [
    // 반도체재료및소자 1 (전자재료공학, 박광욱)
    { rating: 4, body: "박광욱 교수님이 재료공학 관점에서 반도체를 다뤄주셔서 다른 반도체 과목과는 결이 좀 달라요. 결정 구조, 도핑 원리를 재료 특성 중심으로 배웁니다.", hashtags: ["교수님친절"] },
    { rating: 4, body: "전자재료공학 전공생한테는 필수 코스예요. 소자 동작보다는 재료 물성 위주라 화학·재료 배경이 있으면 더 수월합니다.", hashtags: []},
    { rating: 3, body: "과제량이 적지 않은 편입니다. 매 챕터마다 리포트를 제출해야 해서 시간 관리가 필요해요.", hashtags: ["과제많음"] },
    { rating: 5, body: "실험 수업과 병행하면 이해가 훨씬 잘 됩니다. 이론만으로는 헷갈리는 부분이 실습을 통해 명확해졌어요.", hashtags: ["실무중심"] },
    { rating: 4, body: "시험 문제가 개념 이해를 확인하는 서술형이 많아서 암기보다는 원리를 제대로 알아야 합니다.", hashtags: ["시험어려움"] },
    { rating: 4, body: "반도체 소재 쪽 진로를 생각하는 학생들에게 추천합니다. 소자 자체보다 재료에 관심 있는 분들께 특히 잘 맞아요.", hashtags: ["실무중심"] },
  ],
  UIME018: [
    // 반도체공학입문 (정보소재공학, 이철로)
    { rating: 5, body: "이철로 교수님 강의가 정말 친절하고 눈높이에 맞춰주셔서 반도체를 처음 접하는 저학년도 부담 없이 들을 수 있었어요.", hashtags: ["꿀강의", "교수님친절"] },
    { rating: 4, body: "입문 과목이라 그런지 난이도가 높지 않습니다. 반도체 산업 구조나 밸류체인 이해에 좋은 수업이에요.", hashtags: ["꿀강의"] },
    { rating: 4, body: "매주 짧은 퀴즈로 출석을 대신하는데 강의 내용만 잘 들으면 다 맞출 수 있는 수준이라 부담 없었습니다.", hashtags: ["출석중요"] },
    { rating: 3, body: "입문 수업치고는 다루는 범위가 넓어서 얕게 훑고 지나가는 느낌이 있어요. 심화 내용은 다른 전공 과목에서 배워야 합니다.", hashtags: [] },
    { rating: 5, body: "타 전공생도 부담 없이 들을 수 있는 교양성 전공과목이라 추천합니다. 반도체 산업에 관심 있다면 첫 과목으로 딱이에요.", hashtags: ["꿀강의", "실무중심"] },
    { rating: 4, body: "기말 대체 리포트로 관심 있는 반도체 기업 하나를 분석해서 제출했는데 흥미로운 과제였습니다.", hashtags: ["실무중심"] },
  ],
}

async function main() {
  const codes = Object.keys(COURSE_REVIEWS)
  const rows = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, professor: courses.professor, semester: courses.semester })
    .from(courses)
    .where(inArray(courses.code, codes))

  // 코드당 가장 최신 학기 row 하나만 대표로 골라 리뷰를 붙인다(getSiblingCourseIds가 학수번호
  // 기준으로 리뷰를 묶어서 보여주므로, 어느 학기 row에 붙이든 조회 결과는 동일하다).
  const byCode = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    if (!r.code) continue
    const existing = byCode.get(r.code)
    if (!existing || r.semester > existing.semester) byCode.set(r.code, r)
  }

  for (const [code, seeds] of Object.entries(COURSE_REVIEWS)) {
    const course = byCode.get(code)
    if (!course) {
      console.error(`건너뜀: ${code} — courses 테이블에서 찾지 못함`)
      continue
    }

    await db.insert(reviews).values(
      seeds.map((s, i) => ({
        courseId: course.id,
        authorAnonId: `dummy-semiconductor-${code}-${i}`,
        rating: s.rating,
        body: s.body,
        hashtags: s.hashtags,
        semester: course.semester,
        isFiltered: false,
      })),
    )
    console.log(`리뷰 ${seeds.length}건 등록: ${course.name} (${code})`)

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
      console.error(`  AI 요약 생성 실패 (${code}):`, err)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
