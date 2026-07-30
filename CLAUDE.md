# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**수강길잡이** — an AI-assisted course-planning app for Korean university students. Full PRD lives at `docs/PRD.md`; read it for feature detail (F1–F4), personas, and data entities before implementing any feature. Development is tracked sprint-by-sprint in `docs/SPRINT_PLAN.md` — check it for what's done, what's next, and check off items there (with their DoD) as you complete them; log any new decision in its 오픈 이슈 로그 table rather than editing the PRD. Summary:

- **F1** Review hashtags + AI-generated per-course summary (min. 5 reviews to summarize)
- **F2** Unified search: exact course-name matches + academic-field-tag matches, shown as separate result sections
- **F3** Industry/career-field keyword search (e.g. "반도체") spanning departments, ranked by relevance score
- **F4** AI-personalized multi-semester curriculum planner (required courses first, then elective/interest-matched courses), interactive add/remove with recalculation

F4 is live (Sprint 6) but only for the 2 departments with `curricula` data (전자공학부, 컴퓨터인공지능학부, seeded via `lib/db/scripts/seed-curricula.ts`) — real course codes, but illustrative (not official) graduation-requirement numbers and prerequisite links (see Data notes below). Course-add-to-plan (only exclude/recalculate is implemented) and seasonal-term expansion are explicitly out of scope — see Sprint 6 in `docs/SPRINT_PLAN.md`.

## Commands

```bash
# use pnpm via corepack — a bare `pnpm` on PATH is not guaranteed in this environment
corepack pnpm install
corepack pnpm dev            # next dev
corepack pnpm build
corepack pnpm lint

# database (Drizzle + Neon)
corepack pnpm db:generate        # generate a migration from lib/db/schema.ts
corepack pnpm db:studio          # drizzle-kit studio
corepack pnpm exec drizzle-kit migrate   # apply pending migrations to DATABASE_URL
corepack pnpm db:import-courses  # re-import the two course-catalog xlsx files into `courses`

# tests (Vitest)
corepack pnpm test         # runs once; includes a DB integration file that auto-skips without DATABASE_URL
corepack pnpm test:watch
```

`DATABASE_URL` lives in `.env.local` (gitignored, already points at a real Neon project — do not print its value into chat or commits). Scripts that touch the DB load it via `dotenv.config({ path: ".env.local" })`, not the default `dotenv/config` (which reads `.env`) — or run `tsx --env-file=.env.local` for one-off scripts, since `dotenv/config` runs too late relative to ESM import hoisting if the script also imports `lib/db/client.ts` (it throws at import time if `DATABASE_URL` is unset).

AI features (hashtag suggestion, review summaries) use OpenAI via `lib/ai/`. The key lives in `.env.local` as `OPEN_AI_API_KEY` (not the SDK's default `OPENAI_API_KEY` name) — `lib/ai/openai-client.ts` reads it explicitly.

## Architecture

- **Next.js App Router**, React 19, TypeScript. Routes: `/` (home), `/search`, `/fields`, `/courses/[id]`, `/curriculum`. All five are wired to real DB queries (`lib/db/queries.ts`) — no route still depends on `lib/mock-data.ts` for course/curriculum content.
- **UI**: shadcn/ui (`components.json`, style `base-nova`) + Tailwind v4. Path alias `@/*` → repo root. Only `components/ui/button.tsx` has been generated so far; add more via `shadcn` as needed rather than hand-rolling primitives.
- **Package manager is pnpm**, but the workspace's `pnpm` field in `package.json` (`overrides`) is ignored by modern pnpm — build-script allowlisting and other pnpm-specific settings live in `pnpm-workspace.yaml` (`allowBuilds:`) instead.
- **Auth (login required)**: originally anonymous-only (matching PRD's "개인정보 최소 수집" principle), but now gated behind real accounts — `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`/`export function proxy`, don't recreate `middleware.ts`) redirects any request without the `sgz_anon_id` cookie to `/login`, except `/login`/`/signup` and static files. The cookie is only ever set by a successful login/signup, via `lib/auth/session.ts` (`createSession`/`destroySession`) — `proxy.ts` no longer auto-issues it to every visitor. `lib/auth/anon-user.ts` (`getAnonId`/`ensureAnonUser`) still resolves the cookie to a `users` row exactly as before, so all existing anonId-based code (reviews, `/fields` own-department, curriculum profile) is untouched. `app/signup/page.tsx` (2-step: 학번+이메일(`@jbnu.ac.kr` only)+비밀번호 → 6-digit email code) and `app/login/page.tsx` (학번+비밀번호) call `lib/actions/auth.ts` (`requestSignup`/`verifySignupCode`/`login`/`logout`). Passwords hashed with `bcryptjs` (`lib/auth/password.ts`). Verification codes live in the `email_verifications` table (10 min TTL, consumed on use) until confirmed, at which point a real `users` row is created (`studentId`/`email`/`passwordHash`/`emailVerified` columns, migration `0003`). Email sending is via SMTP through an existing mailbox (`lib/auth/mailer.ts`, `nodemailer`, `SMTP_*` env vars) — not a transactional email service; without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set it just logs the code to the console instead of sending, so local dev works without real credentials. Pre-existing anonymous `users` rows (no `studentId`/`passwordHash`) can't log in — there's no migration path for them, by design given this was a deliberate, explicitly-confirmed scope change (see chat history, not written up elsewhere).
- **Server Actions** live in `lib/actions/*.ts` (`"use server"`). `lib/actions/reviews.ts` has `submitReview` (review writes, revalidation, minimal abuse-filtering, and triggers AI summary regeneration) and `suggestReviewHashtags` (AI tag suggestion). `lib/actions/user-profile.ts` has `setMyDepartment` (used by `/fields`' own-major comparison, PRD 8.3). `lib/actions/curriculum.ts` has `generateCurriculumPlan` (F4 — persists the input profile to `users`, then builds and returns a plan; re-invoked wholesale on every exclude-and-recalculate click, there's no server-side plan session state).
- **AI** (`lib/ai/`): `openai-client.ts` (shared client + `AI_MODEL` constant, `gpt-4o-mini`), `hashtags.ts` (`suggestHashtags` — constrained to `predefinedReviewTags`, re-validated server-side against that list), `summary.ts` (`generateCourseSummary` — 3–5 sentence Korean summary, flags polarized ratings), `curriculum-reasons.ts` (`writeElectiveReasons` — rewrites the reason text for an already-ranked list of elective picks; never chooses which courses, only phrases why). All are plain async functions, not Server Actions themselves. Embeddings (`text-embedding-3-small`) are called directly via `openai.embeddings.create` from the offline scripts below, not from `lib/ai/`.
- **`lib/curriculum/`** (F4, no AI): `types.ts` (`PlanItem`/`PlanSemester`/`CurriculumPlanInput`/`CurriculumPlanResult`), `plan.ts` (`placeRequiredCourses` — prerequisite-respecting greedy placement across remaining semesters; `fillElectives` — fills remaining per-semester credit budget from a pre-ranked candidate list up to a total credit budget). Pure functions, deterministic, unit-testable without a DB or network call.

### Database (`lib/db/`)

- `lib/db/schema.ts` — Drizzle schema, the source of truth for the data model. Eleven tables: `courses`, `course_department_tracks`, `field_tags`, `course_field_tags`, `industry_tags`, `course_industry_tags`, `course_embeddings`, `reviews`, `summaries`, `users`, `curricula`. `industry_tags.embedding` and `course_embeddings.embedding` are pgvector columns (`vector(1536)`, extension enabled on the Neon project).
- `lib/db/client.ts` — the app-side Drizzle client (`neon-http` driver), reads `DATABASE_URL` from `process.env`.
- `lib/db/migrations/` — generated by `drizzle-kit generate`; apply with `drizzle-kit migrate`. Don't hand-edit generated SQL.
- `lib/db/scripts/import-courses.ts` — one-off/re-runnable importer for the ten official course-catalog xlsx files, all under the `course/` folder (not repo root — moved there 2026-07-30 when the 교양 files were added): 학부전공/교양/교직/군사학/일반선택 × 2026-1/2026-2 semesters. Same column layout across all ten. Inserts are `onConflictDoNothing` on `(code, section, semester)` — **but that alone isn't enough**: `code` is null for a meaningful share of rows (교양/일반선택/교직/군사학, and some 학부전공 rows too), and Postgres's unique-index NULL semantics treat every null-code row as distinct from every other, so re-running used to silently re-insert duplicates of every null-code course on each run. Fixed 2026-07-30 by adding an explicit existence check (`name`+`department`+`section`+`semester`) before insert whenever `code` is null — re-running is genuinely idempotent now. (The historical duplicates this had already produced were cleaned up via a one-off script; reviews on any affected rows were reassigned to the row that was kept, never dropped.) 일반선택/군사학 catalogs also have some rows with a **null `department`** (schema requires it NOT NULL) — those are skipped as malformed, except 군사학 specifically, where every non-null row in the data is attributed to `"교무처 학사지원과"`, so null department is safely backfilled to that value for `requirementType === "군사학"` only; 일반선택's department is genuinely diverse across many offices, so its null-department rows are just skipped (not guessable).
- `lib/db/scripts/seed-field-tags.ts` — seeds `field_tags` (10 대분류 × 66 소분류, self-authored from this university's actual department list, not a standard taxonomy) plus synonyms. `pnpm db:seed-field-tags`.
- `lib/db/scripts/classify-course-fields.ts` + `apply-field-classification.ts` — two-step AI classification for `course_field_tags`: `classify` calls OpenAI in batches and writes a review-able JSON (`field-classification-result.json`, tracked in git as an audit record) *without* touching the DB; a human edits that file if needed; `apply` inserts from it (idempotent, `onConflictDoNothing`). **Not incremental** — reclassifies every course in the DB each run (cheap enough with `gpt-4o-mini` batched 25/call). Re-run this pair if the course catalog changes materially. `pnpm db:classify-fields` / `pnpm db:apply-field-classification`.
- `lib/db/scripts/seed-industry-tags.ts` — seeds `industry_tags` (11 categories: the original 6 from the old mock `fieldCategories`, plus 5 added 2026-07-30 — 모빌리티·로보틱스/스마트시티·건설/교육·에듀테크/농식품·스마트팜/물류·유통) with a description + OpenAI embedding each; upserts by name so re-running to add more categories is safe. `pnpm db:seed-industry-tags`.
- pgvector pipeline for F3 relevance scoring (same two-step review pattern as field classification): `enable-pgvector.ts` (one-time, `CREATE EXTENSION vector` — already done) → `embed-courses.ts` (embeds each unique subject's name into `course_embeddings`, one row per subject not per semester row — **not incremental**, re-embeds every subject each run, cheap with `text-embedding-3-small`) → `score-industry-relevance.ts` (pgvector cosine similarity `<=>` against each industry tag's embedding, writes `industry-relevance-result.json`, **does not write to the DB**) → `apply-industry-relevance.ts` (inserts into `course_industry_tags`, fanned out to every semester row of each subject; dedupes by `(courseId, industryTagId)` before each insert batch — sibling fan-out can otherwise produce the same pair twice in one batch, which Postgres's `ON CONFLICT DO UPDATE` rejects). Re-run the embed→score→apply chain if `industry_tags` changes or the catalog changes materially.
- `lib/db/scripts/seed-curricula.ts` — seeds `curricula` for 2 departments (전자공학부, 컴퓨터인공지능학부, 2024학번). `requiredCourseCodes` are real 전공필수 course codes pulled from `courses`; `electiveMinCredits`/`generalEducationRequirement`/`totalCreditsRequired` and the `prerequisiteCodes` it writes onto a handful of `courses` rows are **illustrative dummy data** (PRD 8.4 explicitly allows this — no official graduation-requirement or prerequisite document exists). Don't present these numbers as verified/official in the UI; F4 must keep the "참고용" disclaimer. `pnpm db:seed-curricula`.
- Most standalone scripts under `lib/db/scripts/` import `lib/db/client.ts`, which throws at import time if `DATABASE_URL` isn't set — always run them with `tsx --env-file=.env.local`, not a `dotenv.config()` call inside the script (see the ESM hoisting note above). Check each script's own `pnpm db:*` entry in `package.json` for the right invocation.

**Data notes learned from the real catalog files (not in the PRD, keep in mind when building F1–F4):**
- No syllabus text exists in the source files, so F2/F3's AI tagging/embeddings are name-only, not syllabus-based. `courses.syllabusUrl` is schema-ready but always empty. `courses.prerequisiteCodes` is empty except for a handful of courses in the 2 F4-seeded departments, where it holds illustrative (not official) data — see `lib/db/scripts/seed-curricula.ts`.
- `courses.requirementType` (이수구분) has 8 values as of 2026-07-30: `전공필수`/`전공선택`/`기초필수`/`계열공통` (학부전공 catalog, always present) plus `교양`/`일반선택`/`교직`/`군사학` (each a separate catalog file added 2026-07-30, previously absent). Any UI code that keys off `Requirement`/`requirementType` exhaustively (e.g. `Record<Requirement, string>` colour maps in `components/course-badges.tsx`) must cover all 8 — TypeScript will error on the `Record` if one is missed, which is how the last few were caught.
- `courses.credits` / `courses.hours` are `real`, not integer — some courses (e.g. 의학과) carry fractional credits like 2.5.
- `course_department_tracks` parses the catalog's free-text "학과/학년정보" column (e.g. `"기계시스템 3,기계시스템(응용기계) 3"`) into `(departmentLabel, grade)` rows. This is the closest available signal for "which department curriculum + grade does this course count toward," and is what F4's own-major-vs-other-major matching should join against — it does not necessarily match `courses.department` (the offering department) verbatim.
- Real department names come from the university's own naming (e.g. `전자공학부`, not `전자공학과`). `lib/mock-data.ts`'s department names are fictional placeholders and do not match real `courses.department` values — don't assume they line up when wiring UI to real queries.
- `courses` has one row per (code, section, semester) — the same subject has a *different* `courses.id` each semester. Reviews attach to the exact `courses.id` the reviewer was looking at, but reads aggregate across every row sharing the same `code` (see `getSiblingCourseIds` in `lib/db/queries.ts`), otherwise a course's reviews would appear to reset every semester. Keep this in mind for any new query that touches `reviews`/`summaries`.

### Mock data → real data migration

F1/F2/F3/F4 are all on real DB queries now. `lib/mock-data.ts` only has two static UI-copy arrays left: `popularTags` (home search-suggestion chips, intentionally not DB-backed) and `predefinedReviewTags` (the real F1 hashtag taxonomy — lives here for historical reasons, isn't actually mock data). `Course`/`Review`/`HashtagStat`/`Requirement` types are re-exported from `lib/types.ts`, the real source of truth for those shapes — import from there in new code.

## Deployment

Linked to Vercel: project `zip` under team `tarae0419s-projects`, connected to the `Tarae0419/zip` GitHub repo (`.vercel/project.json`, gitignored). `vercel` CLI is a devDependency — invoke via `corepack pnpm exec vercel ...`, not a global install (its own scripts need `node_modules/.bin` on `PATH`, e.g. `.claude/skills/vercel-optimize/scripts/*.mjs`). `DATABASE_URL` and `OPEN_AI_API_KEY` are set on Vercel for all three environments (production/preview/development); if either changes locally, push the new value with `vercel env add <NAME> <environment> --scope tarae0419s-projects` (see `.claude/skills/vercel-cli-with-tokens/SKILL.md` — pipe the value in, never pass secrets as CLI args). Auth is via the user's own `vercel login` session, not a token.

**`main` is Vercel's production branch** — every push to `main` auto-deploys straight to production, no preview/staging gate. Know this before pushing.

**Not yet set up**: the Neon-branch-per-Vercel-preview integration (`.claude/skills/neon-branch-preview-sync/SKILL.md`) needs OAuth consent in the Vercel dashboard that can't be done from the CLI — see Sprint 7.1 in `docs/SPRINT_PLAN.md` for exact steps, still pending as of this writing. Observability Plus is also not enabled on this team, so `vercel-optimize`-style route metrics aren't available yet — only scanner/code-level audits work until then.

## Agents & skills already configured

- `.claude/agents/`: `nextjs-frontend`, `neon-db`, `ai-integration`, `vercel-deploy` — layer-scoped subagents with PRD context baked in. Prefer dispatching to the matching one for larger feature work.
- `.claude/skills/`: official Vercel skills (`deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, installed via `vercel-labs/agent-skills`) plus a project-authored `neon-branch-preview-sync` skill documenting the Neon-branch-per-preview-deployment workflow.

## Open decisions

PRD §10.4 says these live in "§14 open issues," but `docs/PRD.md` has no §14 (it ends at §12) — they're tracked in `docs/SPRINT_PLAN.md`'s 오픈 이슈 로그 instead. Current state:

- ORM: **Drizzle**.
- LLM API vendor: **OpenAI** (`gpt-4o-mini`) — wired up since Sprint 2, see `lib/ai/`.
