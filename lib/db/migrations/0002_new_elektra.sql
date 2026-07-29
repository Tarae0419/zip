CREATE TABLE "course_embeddings" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "industry_tags" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "industry_tags" ADD COLUMN "icon" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "industry_tags" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "course_embeddings" ADD CONSTRAINT "course_embeddings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;