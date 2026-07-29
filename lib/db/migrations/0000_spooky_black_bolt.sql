CREATE TYPE "public"."requirement_type" AS ENUM('전공필수', '전공선택', '기초필수', '계열공통', '교양');--> statement-breakpoint
CREATE TABLE "course_department_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"department_label" varchar(150) NOT NULL,
	"grade" smallint
);
--> statement-breakpoint
CREATE TABLE "course_field_tags" (
	"course_id" uuid NOT NULL,
	"field_tag_id" uuid NOT NULL,
	CONSTRAINT "course_field_tags_course_id_field_tag_id_pk" PRIMARY KEY("course_id","field_tag_id")
);
--> statement-breakpoint
CREATE TABLE "course_industry_tags" (
	"course_id" uuid NOT NULL,
	"industry_tag_id" uuid NOT NULL,
	"relevance_score" real NOT NULL,
	CONSTRAINT "course_industry_tags_course_id_industry_tag_id_pk" PRIMARY KEY("course_id","industry_tag_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32),
	"section" smallint NOT NULL,
	"name" varchar(200) NOT NULL,
	"department" varchar(100) NOT NULL,
	"professor" varchar(100),
	"credits" smallint NOT NULL,
	"hours" smallint,
	"requirement_type" "requirement_type" NOT NULL,
	"language" varchar(20),
	"grading_type" varchar(20),
	"certification_type" varchar(20),
	"target_students" varchar(50),
	"delivery_type" varchar(30),
	"classroom" varchar(150),
	"time_slots" text,
	"session_info" varchar(50),
	"capacity" integer,
	"enrolled_count" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"semester" varchar(10) NOT NULL,
	"syllabus_url" text,
	"prerequisite_codes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curricula" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department" varchar(100) NOT NULL,
	"admission_year" integer NOT NULL,
	"required_course_codes" jsonb DEFAULT '[]'::jsonb,
	"elective_min_credits" integer NOT NULL,
	"general_education_requirement" jsonb DEFAULT '{}'::jsonb,
	"total_credits_required" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"parent_id" uuid,
	"synonyms" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "field_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "industry_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "industry_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"author_anon_id" varchar(64) NOT NULL,
	"rating" smallint NOT NULL,
	"body" text NOT NULL,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"semester" varchar(20) NOT NULL,
	"is_filtered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"based_review_count" integer NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_id" varchar(64) NOT NULL,
	"department" varchar(100),
	"double_major_departments" jsonb DEFAULT '[]'::jsonb,
	"grade" smallint,
	"interest_field_ids" jsonb DEFAULT '[]'::jsonb,
	"completed_course_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_anon_id_unique" UNIQUE("anon_id")
);
--> statement-breakpoint
ALTER TABLE "course_department_tracks" ADD CONSTRAINT "course_department_tracks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_field_tags" ADD CONSTRAINT "course_field_tags_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_field_tags" ADD CONSTRAINT "course_field_tags_field_tag_id_field_tags_id_fk" FOREIGN KEY ("field_tag_id") REFERENCES "public"."field_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_industry_tags" ADD CONSTRAINT "course_industry_tags_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_industry_tags" ADD CONSTRAINT "course_industry_tags_industry_tag_id_industry_tags_id_fk" FOREIGN KEY ("industry_tag_id") REFERENCES "public"."industry_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_tags" ADD CONSTRAINT "field_tags_parent_id_field_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."field_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_code_section_semester_idx" ON "courses" USING btree ("code","section","semester");--> statement-breakpoint
CREATE UNIQUE INDEX "curricula_department_year_idx" ON "curricula" USING btree ("department","admission_year");