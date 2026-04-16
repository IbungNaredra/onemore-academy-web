# PRD v2.2 Option A — implementation status

**Spec source:** `onemore_challenge_prd_v2.2.docx` (internal). This document tracks what the **`onemore-academy-web`** codebase implements today.

---

## Product summary

- **Participants** register with a Garena-domain email, submit UGC in-app during **OPEN** batches, and vote in **assigned groups** (Layer 1) with **1–5** scores, all-or-nothing per group.
- **Roles:** `PARTICIPANT`, `FALLBACK_VOTER`, `INTERNAL_TEAM`, `ADMIN` (see `UserRole` in [`prisma/schema.prisma`](../prisma/schema.prisma)).
- **Categories:** Mini Games vs **Real Life + Prompt** (`ContentCategory`).
- **Batch lifecycle:** `OPEN` → `VOTING` → `CONCLUDED`; optional **`autoTransition`** + cron [`GET /api/cron/batch-transitions`](../app/api/cron/batch-transitions/route.ts) (`CRON_SECRET`). When status first becomes **`VOTING`**, Layer 1 groups and voter assignments are **prepared automatically** if not already done (see [Admin Batches tab](#admin-batches-tab)).
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
| UI feedback (snackbars, loading, redirect toasts) | [`docs/UI-PATTERNS.md`](UI-PATTERNS.md), [`components/snackbar-context.tsx`](../components/snackbar-context.tsx), [`lib/snackbar-url.ts`](../lib/snackbar-url.ts) |

---

## Admin Batches tab

Route: [`/admin/batch`](../app/admin/batch/page.tsx). Server actions: [`app/actions/admin.ts`](../app/actions/admin.ts) (`adminSetBatchSchedule`, `adminSetBatchStatus`, `adminToggleAutoTransition`).

### Schedule (date / time pickers)

- The form uses the browser’s **native** `<input type="datetime-local">` for **Open**, **Voting start**, **Concluded**, and optional **Leaderboard publish**.
- Values are **Asia/Shanghai** wall time (UTC+8, no DST), matching the copy on the page. Conversion helpers live in [`lib/datetime-shanghai.ts`](../lib/datetime-shanghai.ts): `formatUtcAsShanghaiDatetimeLocal` (DB → input) and `parseShanghaiDatetimeLocalToUtc` (submit → UTC `Date`). The database stores UTC instants.
- **Validation:** Open must be before Voting start, and Voting start before Concluded; failures redirect with an error toast (`buildToastUrl`).

### Voting groups preparation (updated mechanism)

- There is **no** separate **“Prepare voting”** button. Preparation runs **automatically** when a batch transitions **OPEN → VOTING**:
  - **Manual:** admin changes status with **Set status** → [`adminSetBatchStatus`](../app/actions/admin.ts) updates the row, then calls [`prepareBatchIfEnteringVoting`](../lib/voting-assign.ts).
  - **Cron:** [`runBatchTransitions`](../lib/batch-jobs.ts) may set status to `VOTING` when `autoTransition` is on and wall-clock crosses `votingAt`; it then calls the same `prepareBatchIfEnteringVoting` helper.
- [`prepareBatchIfEnteringVoting`](../lib/voting-assign.ts) only runs the heavy work ([`prepareBatchForVoting`](../lib/voting-assign.ts): eligibility refresh, Layer 1 groups for both categories, `voterAssignmentDone = true`) when **`voterAssignmentDone`** is still **false**, so idempotent re-entry to `VOTING` does not rebuild groups unnecessarily.
- Each batch card shows **voters assigned** vs **voters not assigned** from `ProgramBatch.voterAssignmentDone`.

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

*Maintained by engineering alongside schema and routes. If you change user-visible feedback (snackbars, loading, redirect messages), update [`UI-PATTERNS.md`](UI-PATTERNS.md) as well. If you change batch schedule pickers, Shanghai parsing, or OPEN→VOTING group preparation, update this section and [`UI-PATTERNS.md`](UI-PATTERNS.md#admin-batches-tab).*
