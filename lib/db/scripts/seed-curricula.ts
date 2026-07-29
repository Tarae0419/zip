// F4 커리큘럼 데이터 시딩 (PRD 8.4). 공식 학과 졸업요건 문서를 확보하지 못해
// PRD 8.4가 명시적으로 허용한 "더미 데이터"로 최소 2개 학과분을 채운다 — 실제 졸업요건이 아니다.
// 단, 전공필수 과목 코드 자체는 실제 개설 데이터(courses.requirement_type = '전공필수')에서 그대로 가져온 진짜 값이다.
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
}

// requiredCourseCodes는 courses 테이블에서 이 학과의 실제 전공필수(전공필수) 학수번호를 조회해 그대로 썼다
// (2026-1/2026-2 두 학기 카탈로그 기준이라, 이 두 학기에 개설되지 않은 전공필수 과목은 빠져 있을 수 있다).
const CURRICULA: CurriculumSeed[] = [
  {
    department: "전자공학부",
    admissionYear: 2024,
    requiredCourseCodes: ["UELC016", "UELC012", "UELC026", "UELC044", "UELC006"],
    electiveMinCredits: 45,
    generalEducationRequirement: { 기초교양: 12, 균형교양: 18, 핵심교양: 6 },
    totalCreditsRequired: 130,
  },
  {
    department: "컴퓨터인공지능학부",
    admissionYear: 2024,
    requiredCourseCodes: ["UCAI016", "UCAI004", "UCAI005", "UCAI006", "UCAI003", "UCAI010"],
    electiveMinCredits: 45,
    generalEducationRequirement: { 기초교양: 12, 균형교양: 18, 핵심교양: 6 },
    totalCreditsRequired: 130,
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
