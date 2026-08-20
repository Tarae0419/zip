"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"
import {
  getCoursesByCodes,
  getCurriculumForDepartment,
  getElectiveCandidates,
  getGeneralEducationElectiveCandidates,
  getIndustryFields,
  getOwnMajorElectiveCourses,
} from "@/lib/db/queries"
import {
  buildSemesters,
  computeSemesterGrades,
  fillElectives,
  fillMajorElectives,
  placeRequiredCourses,
  toSemesterLabels,
} from "@/lib/curriculum/plan"
import type { CurriculumPlanInput, CurriculumPlanResult, PlanItem } from "@/lib/curriculum/types"
import type { AiCandidateCourse } from "@/lib/curriculum/ai-plan-types"
import { reconcileAiPlacements } from "@/lib/curriculum/reconcile-ai-plan"
import { writeElectiveReasons } from "@/lib/ai/curriculum-reasons"
import { planCurriculumWithAI } from "@/lib/ai/curriculum-planner"
import { generateCapabilityActivities } from "@/lib/ai/capability-activities"

export async function generateCurriculumPlan(input: CurriculumPlanInput): Promise<CurriculumPlanResult> {
  const anonId = await getAnonId()
  await ensureAnonUser(anonId)
  await db
    .update(users)
    .set({
      department: input.department,
      doubleMajorDepartments: input.doubleMajorDepartment ? [input.doubleMajorDepartment] : [],
      grade: input.grade,
      completedCourseIds: input.completedRequiredCourseCodes,
      interestFieldIds: input.interestFieldIds,
    })
    .where(eq(users.anonId, anonId))

  const curriculum = await getCurriculumForDepartment(input.department)
  if (!curriculum) {
    return { status: "no_curriculum_data", department: input.department }
  }

  const notes: string[] = []
  const remainingSemesters = Math.max(1, Math.min(input.remainingSemesters, 12))
  // 계획에 들어가는 각 학기가 실제로 몇 학년인지 — 2학년에게 4학년 과목을 추천하지 않도록
  // AI 배치 프롬프트와 lib/curriculum/reconcile-ai-plan.ts(및 폴백 경로의 plan.ts 함수들)이 이 배열로 학년 제약을 건다.
  const semesterGrades = computeSemesterGrades(remainingSemesters, input.grade, input.currentSemester)
  const semesterLabels = toSemesterLabels(remainingSemesters, input.grade, input.currentSemester)
  const excludeSet = new Set([...input.completedRequiredCourseCodes, ...input.excludedCourseCodes])

  const ownRequiredAll = await getCoursesByCodes(curriculum.requiredCourseCodes as string[])
  const ownRequired = ownRequiredAll.filter((c) => !excludeSet.has(c.code))

  let doubleRequired: typeof ownRequired = []
  if (input.doubleMajorDepartment) {
    const doubleCurriculum = await getCurriculumForDepartment(input.doubleMajorDepartment)
    if (!doubleCurriculum) {
      notes.push(`복수전공으로 선택하신 '${input.doubleMajorDepartment}'은(는) 아직 커리큘럼 데이터가 없어 단일 전공 기준으로만 계산했어요.`)
    } else {
      // 타 학과 과목이라도 학수번호나 과목명이 같으면 사실상 같은 과목(중복 학점 인정 불가)이라 둘 다 걸러낸다.
      const ownCodes = new Set(ownRequired.map((c) => c.code))
      const ownNames = new Set(ownRequired.map((c) => c.name))
      const doubleRequiredAll = await getCoursesByCodes(doubleCurriculum.requiredCourseCodes as string[])
      doubleRequired = doubleRequiredAll.filter(
        (c) => !excludeSet.has(c.code) && !ownCodes.has(c.code) && !ownNames.has(c.name),
      )
    }
  }

  const requiredGroups = [
    { courses: ownRequired, type: "전공필수" as const },
    { courses: doubleRequired, type: "복수전공필수" as const },
  ]
  // AI 경로에서는 배치 전에 예산 계산부터 필요해서, placeRequiredCourses를 먼저 돌리는 대신
  // (모든 필수과목은 어차피 어딘가에 반드시 배치되므로) 학점만 먼저 합산한다.
  const requiredCreditsPlaced = ownRequired.reduce((s, c) => s + c.credits, 0) + doubleRequired.reduce((s, c) => s + c.credits, 0)

  const totalRemainingCreditsNeeded = Math.max(0, curriculum.totalCreditsRequired - input.earnedCredits)

  if (ownRequired.length === 0 && doubleRequired.length === 0 && totalRemainingCreditsNeeded <= 6) {
    notes.push("이미 졸업 요건의 대부분을 이수하셨어요. 추천할 수 있는 과목이 많지 않을 수 있어요 — 남은 학점은 학과 사무실에서 정확히 확인해주세요.")
  }

  const industryFields = await getIndustryFields()
  const nameById = new Map(industryFields.map((f) => [f.id, f.name]))
  const interestFieldNames = input.interestFieldIds.map((id) => nameById.get(id)).filter((name): name is string => Boolean(name))
  const capabilityActivitiesPromise = generateCapabilityActivities({
    grade: input.grade,
    department: input.department,
    careerKeyword: input.careerKeyword?.trim().slice(0, 80),
    interestFieldNames,
  })

  // 학수번호 기준 제외 목록(이미 이수·제외·배치된 것)과, 과목명 기준 제외 목록(타 학과 동일 과목명 중복 방지)을 함께 넘긴다.
  const excludedCodesForElectives = [...excludeSet, ...ownRequired.map((c) => c.code), ...doubleRequired.map((c) => c.code)]
  const excludedNamesForElectives = [
    ...ownRequiredAll.filter((c) => excludeSet.has(c.code)).map((c) => c.name), // 이미 이수/제외한 전공필수의 과목명
    ...ownRequired.map((c) => c.name),
    ...doubleRequired.map((c) => c.name),
  ]

  // PRD 8.4 추천로직 7 — 전공선택 요건 잔여 학점부터 본인 학과 전공선택 과목으로 채운다(전공필수와 별개 단계).
  // "기이수 학점"에서 전공필수분을 빼고 추론하던 이전 방식은 기본값(체크된 이수 전공필수 없음)에서
  // 항상 0이 되는 버그가 있었다 — 전공선택으로 이미 인정된 학점은 사용자가 직접 입력하도록 바꿨다.
  // 다만 이 값만으로 채우면 "기이수 학점"(전체 남은 학점, totalRemainingCreditsNeeded)을 아무리 낮춰도
  // 전공선택 추천량이 안 줄어드는 문제가 있었다 — 두 입력이 서로 안 맞을 때는 전체 잔여 학점을 넘지 않게 캡을 건다.
  const remainingAfterRequired = Math.max(0, totalRemainingCreditsNeeded - requiredCreditsPlaced)
  const electiveMinCreditsRemaining = Math.min(
    Math.max(0, curriculum.electiveMinCredits - input.completedElectiveCredits),
    remainingAfterRequired,
  )

  const majorElectiveCandidates =
    electiveMinCreditsRemaining > 0
      ? await getOwnMajorElectiveCourses(input.department, input.interestFieldIds, excludedCodesForElectives, excludedNamesForElectives)
      : []

  if (electiveMinCreditsRemaining > 0 && majorElectiveCandidates.length === 0) {
    notes.push(`전공선택 요건이 ${electiveMinCreditsRemaining}학점 남았는데, 개설된 전공선택 과목을 찾지 못했어요 — 학과 사무실에서 확인해주세요.`)
  }

  // AI 경로용 관심분야 후보 — 전공선택 후보 전체(실제 배치分만이 아니라)를 미리 제외해서, fillMajorElectives를
  // 먼저 돌리지 않고도 두 후보군이 서로 겹치지 않게 한다. AI가 실패해 폴백으로 넘어가면 이 값은 버리고
  // 기존처럼 "실제 배치된" 전공선택만 제외한 채로 다시 조회한다(폴백 경로는 기존 동작 그대로 유지).
  const excludedCodesPlusMajor = [...excludedCodesForElectives, ...majorElectiveCandidates.map((c) => c.code)]
  const excludedNamesPlusMajor = [...excludedNamesForElectives, ...majorElectiveCandidates.map((c) => c.name)]
  const electiveBudget = Math.max(0, totalRemainingCreditsNeeded - requiredCreditsPlaced - electiveMinCreditsRemaining)
  const interestCandidatesFromMajors =
    electiveBudget > 0
      ? await getElectiveCandidates(input.interestFieldIds, input.department, excludedCodesPlusMajor, excludedNamesPlusMajor, 80)
      : []
  // 교양은 학과 제약이 없는 별도 풀로 항상 조회한다 — getElectiveCandidates가 본인 전공을 최우선
  // 정렬하고 나서 80개로 자르기 때문에, 전공 후보가 많으면 연관도 높은 교양 과목도 그 상한에 걸려
  // 후보 풀에 아예 못 들어오는 문제가 있었다(PRD 8.4 Edge Case, 2026-07-31 발견).
  const generalEducationCandidatesForAi =
    electiveBudget > 0
      ? await getGeneralEducationElectiveCandidates(
          input.interestFieldIds,
          [...excludedCodesPlusMajor, ...interestCandidatesFromMajors.map((c) => c.code)],
          [...excludedNamesPlusMajor, ...interestCandidatesFromMajors.map((c) => c.name)],
          20,
        )
      : []
  const interestCandidatesForAi = [...interestCandidatesFromMajors, ...generalEducationCandidatesForAi]

  if (electiveBudget > 0 && interestCandidatesForAi.length === 0 && input.interestFieldIds.length > 0) {
    notes.push("선택하신 관심분야와 연관도가 높은 과목을 충분히 찾지 못했어요. 교양·타 전공 과목을 직접 살펴보시는 걸 권장해요.")
  }

  const candidatesByCode = buildCandidatesByCode({
    department: input.department,
    ownRequired,
    doubleRequired,
    majorElectiveCandidates,
    interestCandidatesForAi,
  })

  let semesterItems: PlanItem[][]

  // PRD 8.4 요구사항 6~11 — 2026-07-31부터 전공필수 배치를 포함한 전체 커리큘럼 설계를 1차로
  // AI(gpt-4o-mini)에 맡긴다. 후보 풀(candidatesByCode)에 없는 과목·범위를 벗어난 학기·선수과목
  // 순서 위반·학점상한 초과는 reconcileAiPlacements가 결정론적으로 검증·보정한다 — AI를 신뢰하지
  // 않는다(lib/ai/hashtags.ts와 동일 패턴). AI 호출 자체가 실패하면(null) 기존 결정론적 파이프라인으로
  // 전체 폴백한다. docs/SPRINT_PLAN.md 오픈 이슈 로그 2026-07-31 참고.
  const aiPlacements = await planCurriculumWithAI({
    remainingSemesters,
    semesterLabels,
    semesterGrades,
    interestFieldNames,
    totalRemainingCreditsNeeded,
    electiveMinCreditsRemaining,
    requiredCourseCodes: [...ownRequired.map((c) => c.code), ...doubleRequired.map((c) => c.code)],
    candidates: [...candidatesByCode.values()],
  })

  if (aiPlacements !== null) {
    const reconciled = reconcileAiPlacements({
      placements: aiPlacements,
      requiredGroups,
      candidatesByCode,
      remainingSemesters,
      semesterGrades,
    })
    semesterItems = reconciled.semesterItems
    notes.push(...reconciled.repairNotes)

    // gpt-4o-mini는 후보 풀·예산이 충분해도 "학기당 16학점까지 채워라"는 지시를 일관되게 따르지
    // 않고 소수만 고르는 경향이 있다(2026-07-31 실사용 중 발견 — 학기당 1~2개만 채워짐). AI가 고르지
    // 않고 남긴 후보로, 이미 검증된 결정론적 로직(fillMajorElectives/fillElectives — 학년·선이수
    // 제약을 이미 처리한다)을 그대로 재사용해 목표 학점까지 마저 채운다. AI가 이미 고른 항목은
    // 건드리지 않는다 — 순수하게 "빈 자리"만 deterministic하게 보충.
    const semesterCreditsAfterAi = reconciled.semesterCredits

    const placedAfterAi = new Set(semesterItems.flat().map((i) => i.courseCode))
    const majorElectiveCreditsUsedByAi = majorElectiveCandidates
      .filter((c) => placedAfterAi.has(c.code))
      .reduce((s, c) => s + c.credits, 0)
    const remainingMajorElectiveCandidates = majorElectiveCandidates.filter((c) => !placedAfterAi.has(c.code))
    const remainingMajorElectiveBudget = Math.max(0, electiveMinCreditsRemaining - majorElectiveCreditsUsedByAi)
    fillMajorElectives(
      semesterItems,
      semesterCreditsAfterAi,
      remainingMajorElectiveCandidates,
      input.department,
      nameById,
      remainingMajorElectiveBudget,
      semesterGrades,
    )

    const placedAfterMajorTopUp = new Set(semesterItems.flat().map((i) => i.courseCode))
    const interestCreditsUsedByAi = interestCandidatesForAi
      .filter((c) => placedAfterMajorTopUp.has(c.code))
      .reduce((s, c) => s + c.credits, 0)
    const remainingInterestCandidates = interestCandidatesForAi.filter((c) => !placedAfterMajorTopUp.has(c.code))
    const remainingInterestBudget = Math.max(0, electiveBudget - interestCreditsUsedByAi)
    fillElectives(semesterItems, semesterCreditsAfterAi, remainingInterestCandidates, nameById, remainingInterestBudget, semesterGrades)
  } else {
    console.error("AI 커리큘럼 설계 실패, 결정론적 로직으로 대체합니다.")

    const placed = placeRequiredCourses(requiredGroups, remainingSemesters, semesterGrades)
    const semesterCredits = placed.semesterCredits
    semesterItems = placed.semesterItems

    const { usedCourseCodes: usedMajorElectiveCodes, totalCreditsPlaced: majorElectiveCreditsPlaced } = fillMajorElectives(
      semesterItems,
      semesterCredits,
      majorElectiveCandidates,
      input.department,
      nameById,
      electiveMinCreditsRemaining,
      semesterGrades,
    )

    const usedMajorElectiveNames = majorElectiveCandidates
      .filter((c) => usedMajorElectiveCodes.has(c.code))
      .map((c) => c.name)

    // 전공선택 요건을 채우고 남은 학점만 관심분야(자유선택·교양) 매칭 추천으로 채운다 (PRD 8.4 추천로직 8~9).
    const fallbackElectiveBudget = Math.max(0, totalRemainingCreditsNeeded - requiredCreditsPlaced - majorElectiveCreditsPlaced)
    const fallbackInterestCandidatesFromMajors =
      fallbackElectiveBudget > 0
        ? await getElectiveCandidates(
            input.interestFieldIds,
            input.department,
            [...excludedCodesForElectives, ...usedMajorElectiveCodes],
            [...excludedNamesForElectives, ...usedMajorElectiveNames],
            80,
          )
        : []
    const fallbackGeneralEducationCandidates =
      fallbackElectiveBudget > 0
        ? await getGeneralEducationElectiveCandidates(
            input.interestFieldIds,
            [...excludedCodesForElectives, ...usedMajorElectiveCodes, ...fallbackInterestCandidatesFromMajors.map((c) => c.code)],
            [...excludedNamesForElectives, ...usedMajorElectiveNames, ...fallbackInterestCandidatesFromMajors.map((c) => c.name)],
            20,
          )
        : []
    const fallbackInterestCandidates = [...fallbackInterestCandidatesFromMajors, ...fallbackGeneralEducationCandidates]

    fillElectives(semesterItems, semesterCredits, fallbackInterestCandidates, nameById, fallbackElectiveBudget, semesterGrades)
    // "관심분야 연관 과목을 못 찾았다" 안내는 AI 경로 진입 전 interestCandidatesForAi 기준으로 이미 위에서 처리했다.

    // 폴백 경로에서만 사유 문구를 AI로 다듬는다 — AI 설계 경로가 성공했다면 이미 모든 항목에
    // planCurriculumWithAI가 만든 사유가 붙어 있어 이중으로 LLM을 호출할 필요가 없다.
    const electiveItems: PlanItem[] = semesterItems.flat().filter((item) => item.type === "관심분야")
    if (electiveItems.length > 0) {
      try {
        const reasonMap = await writeElectiveReasons(
          electiveItems.map((item) => ({
            courseCode: item.courseCode,
            courseName: item.name,
            department: item.department,
            isOwnMajor: item.isOwnMajor,
            matchedInterestField: nameById.get(item.matchedIndustryTagId ?? "") ?? "관심 분야",
          })),
        )
        for (const item of electiveItems) {
          const better = reasonMap.get(item.courseCode)
          if (better) item.reason = better
        }
      } catch (err) {
        console.error("AI 추천 사유 생성 실패, 템플릿 문구를 유지합니다:", err)
      }
    }
  }

  notes.push("본 추천은 참고용이며, 최종 확인은 학과 사무실을 통해주세요.")
  notes.push("선수과목 순서는 공식 교육과정표가 아니라 예시로 채운 데이터를 기준으로 배치했어요.")

  const semesters = buildSemesters(semesterLabels, semesterItems)
  const capabilityActivities = await capabilityActivitiesPromise
  return { status: "ok", semesters, notes, capabilityActivities }
}

/** AI 커리큘럼 설계 호출과 그 검증·보정 단계가 공유하는 신뢰 후보 풀을 조립한다. courseCode 기준 유일 — 각
 * 조회 함수가 이미 코드/이름 기준 중복 제거를 마친 상태로 넘겨주므로 여기서는 단순 병합만 한다. */
function buildCandidatesByCode(params: {
  department: string
  ownRequired: Awaited<ReturnType<typeof getCoursesByCodes>>
  doubleRequired: Awaited<ReturnType<typeof getCoursesByCodes>>
  majorElectiveCandidates: Awaited<ReturnType<typeof getOwnMajorElectiveCourses>>
  interestCandidatesForAi: Awaited<ReturnType<typeof getElectiveCandidates>>
}): Map<string, AiCandidateCourse> {
  const map = new Map<string, AiCandidateCourse>()

  for (const c of params.ownRequired) {
    map.set(c.code, {
      courseCode: c.code,
      courseId: c.courseId,
      name: c.name,
      department: c.department,
      credits: c.credits,
      category: "전공필수",
      requirementType: "전공필수",
      prerequisiteCodes: c.prerequisiteCodes,
      grade: c.grade,
      isOwnMajor: true,
      relevanceScore: null,
      matchedIndustryTagId: null,
    })
  }
  for (const c of params.doubleRequired) {
    map.set(c.code, {
      courseCode: c.code,
      courseId: c.courseId,
      name: c.name,
      department: c.department,
      credits: c.credits,
      category: "복수전공필수",
      requirementType: "복수전공필수",
      prerequisiteCodes: c.prerequisiteCodes,
      grade: c.grade,
      isOwnMajor: true,
      relevanceScore: null,
      matchedIndustryTagId: null,
    })
  }
  for (const c of params.majorElectiveCandidates) {
    map.set(c.code, {
      courseCode: c.code,
      courseId: c.courseId,
      name: c.name,
      department: params.department, // getOwnMajorElectiveCourses는 항상 본인 학과 소속만 반환하므로 필드 자체가 없음
      credits: c.credits,
      category: "전공선택",
      requirementType: "전공선택", // 쿼리 자체가 이미 전공선택으로 필터링해서 가져온 값
      prerequisiteCodes: [],
      grade: c.grade,
      isOwnMajor: true,
      relevanceScore: c.relevanceScore,
      matchedIndustryTagId: c.matchedIndustryTagId,
    })
  }
  for (const c of params.interestCandidatesForAi) {
    map.set(c.code, {
      courseCode: c.code,
      courseId: c.courseId,
      name: c.name,
      department: c.department,
      credits: c.credits,
      category: "관심분야",
      requirementType: c.requirementType,
      prerequisiteCodes: [],
      grade: c.grade,
      isOwnMajor: c.isOwnMajor,
      relevanceScore: c.relevanceScore,
      matchedIndustryTagId: c.industryTagId,
    })
  }

  return map
}
