import { relations } from "drizzle-orm"
import {
  type AnyPgColumn,
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
  vector,
} from "drizzle-orm/pg-core"

// 실제 개설 교과목 목록 엑셀(course/ 폴더)의 "이수구분" 값 기준. 학부전공 카탈로그엔 전공필수/
// 전공선택/기초필수/계열공통만 있었고, 교양·일반선택·교직·군사학은 각각 별도 파일로 2026-07-30에
// 추가되며 실제로 채워지는 값이 됐다(그 전엔 늘 비어 있었다).
export const requirementTypeEnum = pgEnum("requirement_type", [
  "전공필수",
  "전공선택",
  "기초필수",
  "계열공통",
  "교양",
  "일반선택",
  "교직",
  "군사학",
])

// PRD 13장(관리자 기능) — 최초 관리자는 회원가입 경로가 아니라 DB에 직접 시딩한다
// (lib/db/scripts/promote-admin.ts). status는 어뷰징 계정 정지용(삭제 대신 로그인만 차단).
export const userRoleEnum = pgEnum("user_role", ["user", "admin"])
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"])
// curricula 데이터가 학과 사무실 확인을 거친 값인지, 참고용 더미인지 구분(PRD 13.5-4, 8.4 더미 데이터 고지)
export const curriculumDataStatusEnum = pgEnum("curriculum_data_status", ["illustrative", "confirmed"])

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
  parentId: uuid("parent_id").references((): AnyPgColumn => fieldTags.id),
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

/**
 * PRD F3 — 산업/진로 분야 태그. description은 화면 표시용이자 임베딩 생성 원문(이름만으로는
 * 임베딩이 부실해서 짧은 설명을 붙인다). embedding은 pgvector로 과목명 임베딩과 유사도 계산할 때 쓴다(PRD 10.3).
 */
export const industryTags = pgTable("industry_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(), // lucide-react 아이콘 이름
  embedding: vector("embedding", { dimensions: 1536 }),
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

/**
 * 학기별 row 대신 "고유 과목"(학수번호 기준, Sprint 3와 동일한 기준) 하나당 임베딩 하나만 저장한다.
 * courseId는 그 과목군의 대표(canonical) row를 가리킨다(getCanonicalCourseId).
 */
export const courseEmbeddings = pgTable("course_embeddings", {
  courseId: uuid("course_id")
    .primaryKey()
    .references(() => courses.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
})

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

/**
 * PRD 9장 User — 원래 "개인정보 최소 수집" 원칙에 따라 익명 식별자(anonId) 기반이었으나,
 * 실제 회원가입/로그인(학번+비밀번호, @jbnu.ac.kr 이메일 인증)을 추가하며 anonId 쿠키를
 * "로그인 세션 토큰"으로 재사용하는 방식으로 확장했다 — 로그인 성공 시 그 계정의 anonId 값을
 * 쿠키로 내려주므로, 기존 anonId 기반 쿼리(reviews, user-profile 등)는 그대로 동작한다.
 * studentId/email/passwordHash/emailVerified는 실 계정에만 채워지고, 과거 게스트 row는 null.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  anonId: varchar("anon_id", { length: 64 }).notNull().unique(),
  studentId: varchar("student_id", { length: 20 }).unique(),
  email: varchar("email", { length: 150 }).unique(),
  name: varchar("name", { length: 50 }), // 실명 — 헤더에 "OOO님" 인사말로 노출(2026-07-30 추가, 과거 계정은 null)
  passwordHash: varchar("password_hash", { length: 255 }),
  emailVerified: boolean("email_verified").notNull().default(false),
  department: varchar("department", { length: 100 }),
  doubleMajorDepartments: jsonb("double_major_departments").$type<string[]>().default([]),
  grade: smallint("grade"),
  interestFieldIds: jsonb("interest_field_ids").$type<string[]>().default([]),
  completedCourseIds: jsonb("completed_course_ids").$type<string[]>().default([]),
  role: userRoleEnum("role").notNull().default("user"), // PRD 13.2 — 관리자 페이지 접근 권한
  status: userStatusEnum("status").notNull().default("active"), // PRD 13.7 — 정지된 계정은 로그인 불가
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

/**
 * 회원가입 이메일 인증 대기열. 학번+이메일+비밀번호(해시)를 먼저 여기 담아 인증코드를 이메일로
 * 보내고, 코드가 맞아야 users row를 실제로 만든다 — 이메일 인증 전에는 계정이 생성되지 않는다.
 */
export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: varchar("student_id", { length: 20 }).notNull(),
  email: varchar("email", { length: 150 }).notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
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
    dataStatus: curriculumDataStatusEnum("data_status").notNull().default("illustrative"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("curricula_department_year_idx").on(table.department, table.admissionYear)],
)

/**
 * F5 "내 시간표"(장바구니) — 원래는 localStorage(sugang-cart-v1)에만 저장되는 브라우저 로컬
 * 데이터였다. 계정(anonId)과 무관하게 브라우저 하나를 공유하면 서로 다른 계정으로 로그인해도
 * 같은 장바구니가 보이는 문제가 있어(2026-08-01 사용자 신고), 계정별로 실제 분리되도록 DB로
 * 옮겼다. 과목 자체의 학기 정보는 courses.semester에 이미 있어 따로 들고 있지 않는다.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonId: varchar("anon_id", { length: 64 }).notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cart_items_anon_course_idx").on(table.anonId, table.courseId)],
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
