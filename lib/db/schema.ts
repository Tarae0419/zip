import { relations } from "drizzle-orm"
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// 실제 개설 교과목 목록 엑셀(2026_1/2학기_학부전공_개설교과목_목록.xlsx)의 "이수구분" 값 기준.
// 교양 과목은 이 파일에 포함되지 않지만(학부전공 목록이라 "교양영역구분"이 전부 비어 있음),
// 추후 교양 데이터 연동을 대비해 값만 미리 넣어둔다.
export const requirementTypeEnum = pgEnum("requirement_type", [
  "전공필수",
  "전공선택",
  "기초필수",
  "계열공통",
  "교양",
])

/**
 * PRD 9장 Course 엔티티.
 * 컬럼은 학교 수강편람 원본(개설 교과목 목록 엑셀, 26개 컬럼)을 그대로 반영했다.
 * 원본에 없는 강의계획서 본문·선수과목 관계는 추후 별도 확보 전까지 nullable로 둔다.
 */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }), // 학수번호 — 원본에 결측 존재, nullable
    section: smallint("section").notNull(), // 분반
    name: varchar("name", { length: 200 }).notNull(), // 교과목명
    department: varchar("department", { length: 100 }).notNull(), // 개설학과
    professor: varchar("professor", { length: 100 }), // 담당교수
    credits: real("credits").notNull(), // 학점 (예: 2.5학점 존재)
    hours: real("hours"), // 시간(주당 수업시수, 소수 존재)
    requirementType: requirementTypeEnum("requirement_type").notNull(), // 이수구분
    language: varchar("language", { length: 20 }), // 강의언어
    gradingType: varchar("grading_type", { length: 20 }), // 상대/절대평가구분
    certificationType: varchar("certification_type", { length: 20 }), // 인증구분(일반/공학/간호/경영/의학 등)
    targetStudents: varchar("target_students", { length: 50 }), // 수강대상
    deliveryType: varchar("delivery_type", { length: 30 }), // 설강여부(일반/원격강좌 등)
    classroom: varchar("classroom", { length: 150 }), // 강의실
    timeSlots: text("time_slots"), // 시간표 원문(예: "월 6-A,월 6-B,...")
    sessionInfo: varchar("session_info", { length: 50 }), // 수업시간(예: "50분수업(30분단위)")
    capacity: integer("capacity"), // 수강정원
    enrolledCount: integer("enrolled_count"), // 수강인원
    isPublic: boolean("is_public").notNull().default(true), // 공개여부
    semester: varchar("semester", { length: 10 }).notNull(), // "2026-1" | "2026-2" (파일명 기준)
    syllabusUrl: text("syllabus_url"), // 원본 미포함 — 추후 확보 전까지 비움
    prerequisiteCodes: jsonb("prerequisite_codes").$type<string[]>().default([]), // 원본 미포함 — 추후 확보 전까지 비움
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("courses_code_section_semester_idx").on(table.code, table.section, table.semester)],
)

/**
 * "학과/학년정보" 컬럼 파싱 결과. 하나의 과목이 여러 학과·학년 커리큘럼에 동시에
 * 걸쳐 개설되는 경우(예: "기계시스템 3,기계시스템(응용기계) 3")를 표현하며, F4 학과 요건 매칭에 사용한다.
 */
export const courseDepartmentTracks = pgTable("course_department_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  departmentLabel: varchar("department_label", { length: 150 }).notNull(), // 원문 트랙 라벨(개설학과명과 표기가 다를 수 있음)
  grade: smallint("grade"), // 파싱 실패 시 null
})

/** PRD F2 — 학문분야 태그 (대분류-소분류, 동의어 사전 포함) */
export const fieldTags = pgTable("field_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  parentId: uuid("parent_id").references((): any => fieldTags.id),
  synonyms: jsonb("synonyms").$type<string[]>().default([]),
})

export const courseFieldTags = pgTable(
  "course_field_tags",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    fieldTagId: uuid("field_tag_id")
      .notNull()
      .references(() => fieldTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.fieldTagId] })],
)

/** PRD F3 — 산업/진로 분야 태그 (연관도 스코어는 과목-태그 매핑에 저장) */
export const industryTags = pgTable("industry_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
})

export const courseIndustryTags = pgTable(
  "course_industry_tags",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    industryTagId: uuid("industry_tag_id")
      .notNull()
      .references(() => industryTags.id, { onDelete: "cascade" }),
    relevanceScore: real("relevance_score").notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.industryTagId] })],
)

/** PRD F1 / 9장 Review — 익명 작성, 어뷰징 필터링 플래그 포함 */
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  authorAnonId: varchar("author_anon_id", { length: 64 }).notNull(),
  rating: smallint("rating").notNull(),
  body: text("body").notNull(),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  semester: varchar("semester", { length: 20 }).notNull(),
  isFiltered: boolean("is_filtered").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/** PRD F1 — 과목별 캐싱된 AI 요약 (신규 리뷰 누적 시 재생성) */
export const summaries = pgTable("summaries", {
  courseId: uuid("course_id")
    .primaryKey()
    .references(() => courses.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  basedReviewCount: integer("based_review_count").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
})

/** PRD 9장 User — 개인정보 최소 수집(익명 식별자 기반) */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonId: varchar("anon_id", { length: 64 }).notNull().unique(),
  department: varchar("department", { length: 100 }),
  doubleMajorDepartments: jsonb("double_major_departments").$type<string[]>().default([]),
  grade: smallint("grade"),
  interestFieldIds: jsonb("interest_field_ids").$type<string[]>().default([]),
  completedCourseIds: jsonb("completed_course_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/** PRD F4 / 9장 Curriculum — 학과·입학년도별 졸업요건 (버전 관리) */
export const curricula = pgTable(
  "curricula",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    department: varchar("department", { length: 100 }).notNull(),
    admissionYear: integer("admission_year").notNull(),
    requiredCourseCodes: jsonb("required_course_codes").$type<string[]>().default([]),
    electiveMinCredits: integer("elective_min_credits").notNull(),
    generalEducationRequirement: jsonb("general_education_requirement")
      .$type<Record<string, number>>()
      .default({}),
    totalCreditsRequired: integer("total_credits_required").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("curricula_department_year_idx").on(table.department, table.admissionYear)],
)

export const coursesRelations = relations(courses, ({ many, one }) => ({
  fieldTags: many(courseFieldTags),
  industryTags: many(courseIndustryTags),
  departmentTracks: many(courseDepartmentTracks),
  reviews: many(reviews),
  summary: one(summaries, { fields: [courses.id], references: [summaries.courseId] }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
}))
