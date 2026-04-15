# PRD v2.2 Option A — implementation status

**Spec source:** `onemore_challenge_prd_v2.2.docx` (internal). This document tracks what the **`onemore-academy-web`** codebase implements today.

---

## Product summary

- **Participants** register with a Garena-domain email, submit UGC in-app during **OPEN** batches, and vote in **assigned groups** (Layer 1) with **1–5** scores, all-or-nothing per group.
- **Roles:** `PARTICIPANT`, `FALLBACK_VOTER`, `INTERNAL_TEAM`, `ADMIN` (see `UserRole` in [`prisma/schema.prisma`](../prisma/schema.prisma)).
- **Categories:** Mini Games vs **Real Life + Prompt** (`ContentCategory`).
- **Batch lifecycle:** `OPEN` → `VOTING` → `CONCLUDED`; optional **`autoTransition`** + cron [`GET /api/cron/batch-transitions`](../app/api/cron/batch-transitions/route.ts) (`CRON_SECRET`).
- **Leaderboard:** published winners show **name, email, normalized score, link**; **Top 10** block on the same page for **ADMIN** + **INTERNAL_TEAM** only.
- **Google Sheets / Forms:** **not integrated** (v2.2 §16).

---

## Routes (implemented)

| Route | Purpose |
|-------|---------|
| `/` | Redirects signed-in users to `/vote`, others to `/info` |
| `/info` | Challenge copy + schedule |
| `/auth` | Login + self-registration |
| `/login` | Redirects to `/auth` |
| `/submit` | Create/delete submissions (OPEN only) |
| `/vote` | Pending group queue |
| `/vote/[groupId]` | Rate all submissions in a group (1–5), single submit |
| `/leaderboard` | Public winners + internal Top 10 (role-gated) |
| `/finalist` | Finalist-style top-10 view (internal + admin) |
| `/me` | Admin → `/admin`, others → `/vote` |
| `/admin`, `/admin/users`, `/admin/batch`, `/admin/submissions`, `/admin/winners` | Admin panel |

---

## Key files

| Area | Location |
|------|----------|
| Schema | [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Group sizing (PRD §6.2) | [`lib/group-algorithm.ts`](../lib/group-algorithm.ts) |
| Voter assignment + groups | [`lib/voting-assign.ts`](../lib/voting-assign.ts) |
| Eligibility (`canVote`) | [`lib/eligibility.ts`](../lib/eligibility.ts) |
| Scores / normalization | [`lib/scoring.ts`](../lib/scoring.ts) |
| URL check | [`lib/url-check.ts`](../lib/url-check.ts) |
| Batch cron helper | [`lib/batch-jobs.ts`](../lib/batch-jobs.ts) |
| Server actions | [`app/actions/submit.ts`](../app/actions/submit.ts), [`vote.ts`](../app/actions/vote.ts), [`admin.ts`](../app/actions/admin.ts) |
| Registration API | [`app/api/auth/register/route.ts`](../app/api/auth/register/route.ts) |

---

## Database migration

- Apply [`prisma/migrations/20260415000000_prd_v22_option_a/migration.sql`](../prisma/migrations/20260415000000_prd_v22_option_a/migration.sql) (destructive: drops legacy v1.3 tables if present).
- Then `npm run db:seed`.

---

## Gaps / follow-ups vs full PRD v2.2

| Topic | Status |
|-------|--------|
| **ZH / EN (`next-intl`)** | Not implemented — UI strings are English-only for now |
| **Wednesday Layer 2** (UNDER_REVIEWED groups, internal/fallback voting UI) | Partial: `flagUnderReviewedGroups` in [`lib/batch-jobs.ts`](../lib/batch-jobs.ts); no full L2 assignment + vote flows |
| **Per-batch `canVote` matrix in admin** | Logic exists; dedicated admin UX can be expanded |
| **Railway + persistent cron** | Documented expectation in PRD; deploy with `CRON_SECRET` hitting the cron route |
| **Award labels on winner cards** | v2.1+ removed per spec; winners are submission-based with scores |

---

*Maintained by engineering alongside schema and routes.*
