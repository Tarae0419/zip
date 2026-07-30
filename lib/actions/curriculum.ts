"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { ensureAnonUser, getAnonId } from "@/lib/auth/anon-user"
import {
  getCoursesByCodes,
  getCurriculumForDepartment,
  getElectiveCandidates,
  getIndustryFields,
  getOwnMajorElectiveCourses,
} from "@/lib/db/queries"
import { buildSemesters, fillElectives, fillMajorElectives, placeRequiredCourses, toSemesterLabels } from "@/lib/curriculum/plan"
import type { CurriculumPlanInput, CurriculumPlanResult, PlanItem } from "@/lib/curriculum/types"
import { writeElectiveReasons } from "@/lib/ai/curriculum-reasons"

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

  const { semesterItems, semesterCredits, requiredCreditsPlaced } = placeRequiredCourses(
    [
      { courses: ownRequired, type: "전공필수" },
      { courses: doubleRequired, type: "복수전공필수" },
    ],
    remainingSemesters,
  )

  const totalRemainingCreditsNeeded = Math.max(0, curriculum.totalCreditsRequired - input.earnedCredits)

  if (ownRequired.length === 0 && doubleRequired.length === 0 && totalRemainingCreditsNeeded <= 6) {
    notes.push("이미 졸업 요건의 대부분을 이수하셨어요. 추천할 수 있는 과목이 많지 않을 수 있어요 — 남은 학점은 학과 사무실에서 정확히 확인해주세요.")
  }

  const industryFields = await getIndustryFields()
  const nameById = new Map(industryFields.map((f) => [f.id, f.name]))

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
  const { usedCourseCodes: usedMajorElectiveCodes, totalCreditsPlaced: majorElectiveCreditsPlaced } = fillMajorElectives(
    semesterItems,
    semesterCredits,
    majorElectiveCandidates,
    input.department,
    nameById,
    electiveMinCreditsRemaining,
  )

  if (electiveMinCreditsRemaining > 0 && majorElectiveCandidates.length === 0) {
    notes.push(`전공선택 요건이 ${electiveMinCreditsRemaining}학점 남았는데, 개설된 전공선택 과목을 찾지 못했어요 — 학과 사무실에서 확인해주세요.`)
  }

  const usedMajorElectiveNames = majorElectiveCandidates
    .filter((c) => usedMajorElectiveCodes.has(c.code))
    .map((c) => c.name)

  // 전공선택 요건을 채우고 남은 학점만 관심분야(자유선택·교양) 매칭 추천으로 채운다 (PRD 8.4 추천로직 8~9).
  const electiveBudget = Math.max(0, totalRemainingCreditsNeeded - requiredCreditsPlaced - majorElectiveCreditsPlaced)
  const candidates =
    electiveBudget > 0
      ? await getElectiveCandidates(
          input.interestFieldIds,
          input.department,
          [...excludedCodesForElectives, ...usedMajorElectiveCodes],
          [...excludedNamesForElectives, ...usedMajorElectiveNames],
          80,
        )
      : []

  fillElectives(semesterItems, semesterCredits, candidates, nameById, electiveBudget)

  if (electiveBudget > 0 && candidates.length === 0 && input.interestFieldIds.length > 0) {
    notes.push("선택하신 관심분야와 연관도가 높은 과목을 충분히 찾지 못했어요. 교양·타 전공 과목을 직접 살펴보시는 걸 권장해요.")
  }

  // PRD 8.4 요구사항 11 / 10.3 — 관심분야 매칭 추천의 사유 문구만 LLM으로 다듬는다 (선정 자체는 이미 결정론적으로 끝남).
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

  notes.push("본 추천은 참고용이며, 최종 확인은 학과 사무실을 통해주세요.")
  notes.push("선수과목 순서는 공식 교육과정표가 아니라 예시로 채운 데이터를 기준으로 배치했어요.")

  const semesters = buildSemesters(toSemesterLabels(remainingSemesters, input.grade, input.currentSemester), semesterItems)
  return { status: "ok", semesters, notes }
}
