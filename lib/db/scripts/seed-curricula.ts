// F4 커리큘럼 데이터 시딩 (PRD 8.4).
// 2026-08-01부터: totalCreditsRequired/electiveMinCredits/generalEducationRequirement는 사용자가 제공한
// 공식 수강편람(docs/2026학년도 2학기 수강편람_(국문ver.).pdf, "2.2 2020~2024학년도 입학자 졸업학점" 표,
// 두 학과 모두 2024학번에 적용되는 최신 개정 행 기준)에서 실측한 진짜 값이다 — 더 이상 더미 데이터가 아니다.
// requiredCourseCodes는 원래부터 실제 개설 데이터(courses.requirement_type = '전공필수')에서 가져온 값이었고,
// 그 credits 합계가 수강편람의 "전필(전공필수 최소학점)" 값과 정확히 일치함을 확인했다(전자공학부 15, 컴퓨터인공지능학부 18).
// "심화전공학점"(전자공학부 21, 컴퓨터인공지능학부 27) 카테고리는 현재 스키마(curricula 테이블)에 대응하는
// 컬럼이 없어 반영하지 못했다 — F4가 심화전공을 별도로 다루게 되면 스키마 확장이 필요하다.
// prerequisiteCodes(PREREQUISITES 배열, 아래)는 이 수강편람에도 실려 있지 않다 — 여전히 더미/예시 데이터다.
// 실행: pnpm db:seed-curricula
import { eq } from "drizzle-orm"
import { db } from "../client"
import { courses, curricula } from "../schema"

type CurriculumSeed = {
  department: string
  admissionYear: number
  requiredCourseCodes: string[]
  electiveMinCredits: number
  generalEducationRequirement: Record<string, number>
  totalCreditsRequired: number
  // curricula 행 자체(요건 숫자들)의 출처 신뢰도 — prerequisiteCodes는 별도 테이블(courses)이라
  // 이 필드로 표현되지 않는다. "confirmed"는 공식 수강편람에서 실측했다는 뜻.
  dataStatus: "illustrative" | "confirmed"
}

// requiredCourseCodes는 courses 테이블에서 이 학과의 실제 전공필수(전공필수) 학수번호를 조회해 그대로 썼다
// (2026-1/2026-2 두 학기 카탈로그 기준이라, 이 두 학기에 개설되지 않은 전공필수 과목은 빠져 있을 수 있다).
const CURRICULA: CurriculumSeed[] = [
  {
    // 수강편람 p.12(2021년 적용 개정행, 2024학번까지 유효) — 전필 15/전선(전공선택 최소) 30/졸업 130.
    department: "전자공학부",
    admissionYear: 2024,
    requiredCourseCodes: ["UELC016", "UELC012", "UELC026", "UELC044", "UELC006"],
    electiveMinCredits: 30,
    generalEducationRequirement: { 기초교양: 9, 핵심교양: 20, 일반교양: 19 },
    totalCreditsRequired: 130,
    dataStatus: "confirmed",
  },
  {
    // 수강편람 p.16(2023년 적용 개정행, 2024학번까지 유효 — 구 IT지능정보공학과) — 전필 18/전선 30/졸업 130.
    department: "컴퓨터인공지능학부",
    admissionYear: 2024,
    requiredCourseCodes: ["UCAI016", "UCAI004", "UCAI005", "UCAI006", "UCAI003", "UCAI010"],
    electiveMinCredits: 30,
    generalEducationRequirement: { 기초교양: 12, 핵심교양: 18, 일반교양: 4, 선택교양: 2 },
    totalCreditsRequired: 130,
    dataStatus: "confirmed",
  },
]

// 선수과목 관계도 원본 데이터엔 없어(Sprint 0) 같은 기준(PRD 8.4 더미 데이터 허용)으로 채우는 예시 데이터다.
// 실제 학과 교육과정표를 확인한 게 아니라 일반적인 전공 이수 순서를 참고해 만든 예시이므로,
// 실제 선수과목 요건과 다를 수 있다 — 검증되면 이 배열만 고치면 된다.
const PREREQUISITES: { code: string; prerequisiteCodes: string[] }[] = [
  { code: "UCAI003", prerequisiteCodes: ["UCAI006"] }, // 알고리즘 ← 자료구조
  { code: "UCAI004", prerequisiteCodes: ["UCAI006"] }, // 운영체제 ← 자료구조
  { code: "UCAI016", prerequisiteCodes: ["UCAI006"] }, // 데이터베이스 ← 자료구조
  { code: "UCAI005", prerequisiteCodes: ["UCAI003"] }, // 인공지능 ← 알고리즘
  { code: "UELC016", prerequisiteCodes: ["UELC026", "UELC044"] }, // 전자회로실험 ← 회로이론 1, 기초회로실험
  { code: "UELC006", prerequisiteCodes: ["UELC026"] }, // 신호및시스템 ← 회로이론 1
]

async function main() {
  for (const c of CURRICULA) {
    await db
      .insert(curricula)
      .values(c)
      .onConflictDoUpdate({ target: [curricula.department, curricula.admissionYear], set: c })
    console.log(`커리큘럼 시딩: ${c.department} ${c.admissionYear}학번`)
  }

  for (const p of PREREQUISITES) {
    const result = await db
      .update(courses)
      .set({ prerequisiteCodes: p.prerequisiteCodes })
      .where(eq(courses.code, p.code))
      .returning({ id: courses.id })
    console.log(`선수과목 반영: ${p.code} ← [${p.prerequisiteCodes.join(", ")}] (${result.length}개 학기 row)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
