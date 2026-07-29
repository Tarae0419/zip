# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**수강길잡이** — an AI-assisted course-planning app for Korean university students. Full PRD lives at `docs/PRD.md`; read it for feature detail (F1–F4), personas, and data entities before implementing any feature. Development is tracked sprint-by-sprint in `docs/SPRINT_PLAN.md` — check it for what's done, what's next, and check off items there (with their DoD) as you complete them; log any new decision in its 오픈 이슈 로그 table rather than editing the PRD. Summary:

- **F1** Review hashtags + AI-generated per-course summary (min. 5 reviews to summarize)
- **F2** Unified search: exact course-name matches + academic-field-tag matches, shown as separate result sections
- **F3** Industry/career-field keyword search (e.g. "반도체") spanning departments, ranked by relevance score
- **F4** AI-personalized multi-semester curriculum planner (required courses first, then elective/interest-matched courses), interactive add/remove with recalculation

F4 requires prerequisite-relationship and official curriculum/graduation-requirement data that is **not yet available** (see Data notes below) — treat it as blocked/partial until that data exists.

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
```

There is no test suite configured yet.

`DATABASE_URL` lives in `.env.local` (gitignored, already points at a real Neon project — do not print its value into chat or commits). Scripts that touch the DB load it via `dotenv.config({ path: ".env.local" })`, not the default `dotenv/config` (which reads `.env`) — or run `tsx --env-file=.env.local` for one-off scripts, since `dotenv/config` runs too late relative to ESM import hoisting if the script also imports `lib/db/client.ts` (it throws at import time if `DATABASE_URL` is unset).

AI features (hashtag suggestion, review summaries) use OpenAI via `lib/ai/`. The key lives in `.env.local` as `OPEN_AI_API_KEY` (not the SDK's default `OPENAI_API_KEY` name) — `lib/ai/openai-client.ts` reads it explicitly.

## Architecture

- **Next.js App Router**, React 19, TypeScript. Routes: `/` (home), `/search`, `/fields`, `/courses/[id]`, `/curriculum`. `/`, `/search`, `/courses/[id]`, `/fields` are wired to real DB queries (`lib/db/queries.ts`); only `/curriculum` still renders `components/curriculum-planner.tsx` against `lib/mock-data.ts` (F4, blocked on Sprint 5/6 — see `docs/SPRINT_PLAN.md`).
- **UI**: shadcn/ui (`components.json`, style `base-nova`) + Tailwind v4. Path alias `@/*` → repo root. Only `components/ui/button.tsx` has been generated so far; add more via `shadcn` as needed rather than hand-rolling primitives.
- **Package manager is pnpm**, but the workspace's `pnpm` field in `package.json` (`overrides`) is ignored by modern pnpm — build-script allowlisting and other pnpm-specific settings live in `pnpm-workspace.yaml` (`allowBuilds:`) instead.
- **Anonymous identity**: `middleware.ts` issues a `sgz_anon_id` httpOnly cookie to every visitor (no login, matches PRD's "개인정보 최소 수집" principle). `lib/auth/anon-user.ts` (`getAnonId`/`ensureAnonUser`, server-only — uses `next/headers`) resolves it to a `users` row, created lazily on first write (e.g. first review). Don't build a real auth system on top of this without checking with the user first — it's intentionally minimal.
- **Server Actions** live in `lib/actions/*.ts` (`"use server"`). `lib/actions/reviews.ts` has `submitReview` (review writes, revalidation, minimal abuse-filtering, and triggers AI summary regeneration) and `suggestReviewHashtags` (AI tag suggestion). `lib/actions/user-profile.ts` has `setMyDepartment` (used by `/fields`' own-major comparison, PRD 8.3).
- **AI** (`lib/ai/`): `openai-client.ts` (shared client + `AI_MODEL` constant, `gpt-4o-mini`), `hashtags.ts` (`suggestHashtags` — constrained to `predefinedReviewTags`, re-validated server-side against that list), `summary.ts` (`generateCourseSummary` — 3–5 sentence Korean summary, flags polarized ratings). Both are plain async functions, not Server Actions themselves — call them from a Server Action or RSC. Embeddings (`text-embedding-3-small`) are called directly via `openai.embeddings.create` from the offline scripts below, not from `lib/ai/`.

### Database (`lib/db/`)

- `lib/db/schema.ts` — Drizzle schema, the source of truth for the data model. Eleven tables: `courses`, `course_department_tracks`, `field_tags`, `course_field_tags`, `industry_tags`, `course_industry_tags`, `course_embeddings`, `reviews`, `summaries`, `users`, `curricula`. `industry_tags.embedding` and `course_embeddings.embedding` are pgvector columns (`vector(1536)`, extension enabled on the Neon project).
- `lib/db/client.ts` — the app-side Drizzle client (`neon-http` driver), reads `DATABASE_URL` from `process.env`.
- `lib/db/migrations/` — generated by `drizzle-kit generate`; apply with `drizzle-kit migrate`. Don't hand-edit generated SQL.
- `lib/db/scripts/import-courses.ts` — one-off/re-runnable importer for the two official course-catalog xlsx files (`2026_1학기_학부전공_개설교과목_목록.xlsx`, `2026_2학기_학부전공_개설교과목_목록.xlsx`) at repo root. Inserts are `onConflictDoNothing` on `(code, section, semester)`, so re-running is safe.
- `lib/db/scripts/seed-field-tags.ts` — seeds `field_tags` (10 대분류 × 66 소분류, self-authored from this university's actual department list, not a standard taxonomy) plus synonyms. `pnpm db:seed-field-tags`.
- `lib/db/scripts/classify-course-fields.ts` + `apply-field-classification.ts` — two-step AI classification for `course_field_tags`: `classify` calls OpenAI in batches and writes a review-able JSON (`field-classification-result.json`, tracked in git as an audit record) *without* touching the DB; a human edits that file if needed; `apply` inserts from it (idempotent). Re-run this pair if the course catalog changes materially. `pnpm db:classify-fields` / `pnpm db:apply-field-classification`.
- `lib/db/scripts/seed-industry-tags.ts` — seeds `industry_tags` (6 categories, same set as the old mock `fieldCategories`) with a description + OpenAI embedding each. `pnpm db:seed-industry-tags`.
- pgvector pipeline for F3 relevance scoring (same two-step review pattern as field classification): `enable-pgvector.ts` (one-time, `CREATE EXTENSION vector` — already done) → `embed-courses.ts` (embeds each unique subject's name into `course_embeddings`, one row per subject not per semester row) → `score-industry-relevance.ts` (pgvector cosine similarity `<=>` against each industry tag's embedding, writes `industry-relevance-result.json`, **does not write to the DB**) → `apply-industry-relevance.ts` (inserts into `course_industry_tags`, fanned out to every semester row of each subject). Re-run the embed→score→apply chain if `industry_tags` changes or the catalog changes materially.
- Most standalone scripts under `lib/db/scripts/` import `lib/db/client.ts`, which throws at import time if `DATABASE_URL` isn't set — always run them with `tsx --env-file=.env.local`, not a `dotenv.config()` call inside the script (see the ESM hoisting note above). Check each script's own `pnpm db:*` entry in `package.json` for the right invocation.

**Data notes learned from the real catalog files (not in the PRD, keep in mind when building F1–F4):**
- No syllabus text and no prerequisite (선수과목) data exists in the source files. `courses.syllabusUrl` / `courses.prerequisiteCodes` are schema-ready but always empty — F4's "선수과목 순서 고려 배치" and F2/F3's syllabus-based AI tagging cannot use real data yet.
- The catalog files are 학부전공(major) only — no 교양(gen-ed) courses are present (교양영역구분 is always null). A separate gen-ed source file would be needed before F2 can search 교양 courses.
- `courses.credits` / `courses.hours` are `real`, not integer — some courses (e.g. 의학과) carry fractional credits like 2.5.
- `course_department_tracks` parses the catalog's free-text "학과/학년정보" column (e.g. `"기계시스템 3,기계시스템(응용기계) 3"`) into `(departmentLabel, grade)` rows. This is the closest available signal for "which department curriculum + grade does this course count toward," and is what F4's own-major-vs-other-major matching should join against — it does not necessarily match `courses.department` (the offering department) verbatim.
- Real department names come from the university's own naming (e.g. `전자공학부`, not `전자공학과`). `lib/mock-data.ts`'s department names are fictional placeholders and do not match real `courses.department` values — don't assume they line up when wiring UI to real queries.
- `courses` has one row per (code, section, semester) — the same subject has a *different* `courses.id` each semester. Reviews attach to the exact `courses.id` the reviewer was looking at, but reads aggregate across every row sharing the same `code` (see `getSiblingCourseIds` in `lib/db/queries.ts`), otherwise a course's reviews would appear to reset every semester. Keep this in mind for any new query that touches `reviews`/`summaries`.

### Mock data → real data migration

F1/F2/F3 are fully on real DB queries now. `lib/mock-data.ts` only has what F4 (`/curriculum`, `components/curriculum-planner.tsx`) still needs: `departments`, `interestFields`, `mockCurriculum`/`CurriculumSemester`/`CurriculumItem` — plus `popularTags` (home search-suggestion chips, intentionally static UI copy, not DB-backed) and `predefinedReviewTags` (the real F1 hashtag taxonomy, lives here for historical reasons but isn't mock data). `Course`/`Review`/`HashtagStat`/`Requirement` types are re-exported from `lib/types.ts`, the real source of truth for those shapes — import from there in new code. `grep -rl "mock-data" app components` lists every current consumer.

## Deployment

Linked to Vercel: project `zip` under team `tarae0419s-projects`, connected to the `Tarae0419/zip` GitHub repo (`.vercel/project.json`, gitignored). `vercel` CLI is a devDependency — invoke via `corepack pnpm exec vercel ...`, not a global install. `DATABASE_URL` and `OPEN_AI_API_KEY` are set on Vercel for all three environments (production/preview/development); if either changes locally, push the new value with `vercel env add <NAME> <environment> --scope tarae0419s-projects` (see `.claude/skills/vercel-cli-with-tokens/SKILL.md` — pipe the value in, never pass secrets as CLI args). Auth is via the user's own `vercel login` session, not a token.

## Agents & skills already configured

- `.claude/agents/`: `nextjs-frontend`, `neon-db`, `ai-integration`, `vercel-deploy` — layer-scoped subagents with PRD context baked in. Prefer dispatching to the matching one for larger feature work.
- `.claude/skills/`: official Vercel skills (`deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, installed via `vercel-labs/agent-skills`) plus a project-authored `neon-branch-preview-sync` skill documenting the Neon-branch-per-preview-deployment workflow.

## Open decisions

PRD §10.4 says these live in "§14 open issues," but `docs/PRD.md` has no §14 (it ends at §12) — they're tracked in `docs/SPRINT_PLAN.md`'s 오픈 이슈 로그 instead. Current state:

- ORM: **Drizzle**.
- LLM API vendor: **OpenAI** (`gpt-4o-mini`) — wired up since Sprint 2, see `lib/ai/`.
