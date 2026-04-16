# PRD v2.2 Option A — implementation status

**Spec source:** `onemore_challenge_prd_v2.2.docx` (internal). This document tracks what the **`onemore-academy-web`** codebase implements today.

---

## Product summary

- **Participants** register with a Garena-domain email, submit UGC in-app during **OPEN** batches, and vote in **assigned groups** (Layer 1) with **1–5** scores, all-or-nothing per group.
- **Roles:** `PARTICIPANT`, `FALLBACK_VOTER`, `INTERNAL_TEAM`, `ADMIN` (see `UserRole` in [`prisma/schema.prisma`](../prisma/schema.prisma)).
- **Categories:** Mini Games vs **Real Life + Prompt** (`ContentCategory`).
- **Batch lifecycle:** **`CLOSED`** (competition not open yet; no submissions or voting) → `OPEN` → `VOTING` → **`INTERNAL_VOTING`** → **`CONCLUDED`**. Cron (optional **`autoTransition`**) can advance **`CLOSED` → `OPEN`** at **`openAt`**, then **`OPEN` → `VOTING`** at **`votingAt`**, and **`VOTING` → `INTERNAL_VOTING`** at **`concludedAt`** ([`GET /api/cron/batch-transitions`](../app/api/cron/batch-transitions/route.ts), `CRON_SECRET`). New batches default to **`CLOSED`**. When status first becomes **`VOTING`**, Layer 1 groups and voter assignments are **prepared automatically** if not already done (see [Admin Batches tab](#admin-batches-tab)). Entering **`INTERNAL_VOTING`** runs **`UNDER_REVIEWED`** flagging (50% rule). **`CONCLUDED`** is set **manually** when internal review is done and the batch is ready for winner selection / public leaderboard (see [Layer 2 — UNDER_REVIEWED](#layer-2--under-reviewed-prd-64)).
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
| `/admin`, `/admin/users`, `/admin/batch`, `/admin/submissions`, `/admin/winners`, `/admin/under-reviewed` | Admin panel |

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
| Batch cron helper | [`lib/batch-jobs.ts`](../lib/batch-jobs.ts) (`runBatchTransitions`, `flagUnderReviewedGroups`) |
| Layer 2 window + vote queue filters | [`lib/layer2-voting.ts`](../lib/layer2-voting.ts), [`lib/vote-queue-where.ts`](../lib/vote-queue-where.ts) |
| UNDER_REVIEWED metrics (extra voters) | [`lib/under-reviewed-metrics.ts`](../lib/under-reviewed-metrics.ts) |
| Server actions | [`app/actions/submit.ts`](../app/actions/submit.ts), [`vote.ts`](../app/actions/vote.ts), [`admin.ts`](../app/actions/admin.ts) |
| Registration API | [`app/api/auth/register/route.ts`](../app/api/auth/register/route.ts) — requires **`password` + `passwordConfirm`** match (also checked on [`/auth`](../app/auth/page.tsx) before submit) |
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

## Which batch gets new submissions (`batchId`)

Participants **do not** choose Batch 1 vs Batch 2 on the submit form. The server picks the batch with [`resolveSubmissionBatch`](../lib/submission-batch.ts) at submit time (`createSubmission` in [`app/actions/submit.ts`](../app/actions/submit.ts)).

| Rule | Detail |
|------|--------|
| **Status** | Only batches with **`BatchStatus.OPEN`** are considered. |
| **Time window** | Current time **`now`** must satisfy **`openAt <= now < votingAt`** (UTC instants in the DB; admin edits **Open** and **Voting start** in the Batches tab as Asia/Shanghai). |
| **Tie-break** | Candidates are ordered by **`batchNumber` ascending**; the **first** batch that passes the window check wins. If two batches overlap (misconfiguration), the **lowest `batchNumber`** receives submissions. |
| **None** | If no row matches, submission is rejected (“No batch is accepting submissions…”). |

So **which batch** a UGC attaches to depends on **schedule dates**, **`status`**, and **wall-clock time** — not on manual batch selection.

---

## Normalized scores (when they update vs what pages read)

Implementation: [`lib/scoring.ts`](../lib/scoring.ts) (`refreshNormalizedScoresForBatchCategory`).

| Topic | Behavior |
|-------|----------|
| **What is stored** | Each `Submission` has **`normalizedScore`** (and **`totalRatingsReceived`**) in the database. |
| **How it is computed** | For each submission in a **batch + category**, average all **1–5** `Rating` rows, then **min–max normalize** those averages to a **0–5** scale within that batch+category (if min = max, the average is used as-is). |
| **When it runs** | After a successful Layer 1 **group** vote, [`submitGroupRatings`](../app/actions/vote.ts) saves ratings, then calls **`refreshNormalizedScoresForBatchCategory`** for that batch and category. So scores in the DB move forward **as votes are saved**, not on a separate nightly job. |
| **Finalist pool (`/finalist`)** | [`getFinalistsByBatch`](../lib/program-batch-public.ts) reads the **top 10** `Submission` rows per batch per category with **non-null** `normalizedScore`, ordered by **`normalizedScore` desc** — it does **not** recompute min–max on that page; it reflects **stored** values at **request time**. |
| **Leaderboard / internal Top 10** | Uses published winners and/or stored scores similarly; no live push — **reload** the page to see the latest rankings after new votes. |

---

## Layer 2 — UNDER_REVIEWED (PRD §6.4)

### Detection (50% rule)

- When a batch enters **`INTERNAL_VOTING`**, [`flagUnderReviewedGroups`](../lib/batch-jobs.ts) runs — when **cron** transitions `VOTING → INTERNAL_VOTING`, when **admin** sets status to **`INTERNAL_VOTING`**, or when **admin** jumps `VOTING → CONCLUDED` (same flagging for parity) ([`adminSetBatchStatus`](../app/actions/admin.ts)).
- Per Layer 1 group: **completion rate** = voters who completed the group ÷ total assignments. **`≥ 50%`** → `VALID`; **`< 50%`** → **`UNDER_REVIEWED`**.
- Admin can **re-run** the same calculation for any **`INTERNAL_VOTING`** or **`CONCLUDED`** batch from [`/admin/under-reviewed`](../app/admin/under-reviewed/page.tsx) (**Recalculate**).

### Layer 2 “open” vs batch ending

- **Layer 2 voting** is allowed when the batch is **`INTERNAL_VOTING`**, **`winnersPublishedAt`** is still **null**, and **`layer2EndsAt`** is null or still in the future — see [`isLayer2VotingOpen`](../lib/layer2-voting.ts).
- Publishing winners sets **`winnersPublishedAt`** ([`adminPublishWinners`](../app/actions/admin.ts)), which **closes** Layer 2 for that batch.

### Admin compilation and assignment

- **[`/admin/under-reviewed`](../app/admin/under-reviewed/page.tsx)** lists **`UNDER_REVIEWED`** groups while the batch is **`INTERNAL_VOTING`**, with completion rate and **suggested extra voters** to reach 50% ([`additionalVotersToReachHalf`](../lib/under-reviewed-metrics.ts)).
- Admin assigns **`internal_team`** and **`fallback_voter`** users via **`adminAssignLayer2Voters`** — adds **`GroupVoterAssignment`** rows on the **same** `ContentGroup` (no new groups). Assignment is allowed while the batch is **`INTERNAL_VOTING`** and **`winnersPublishedAt`** is still **null** ([`isLayer2AdminAssignmentAllowed`](../lib/layer2-voting.ts)); it does **not** require the optional **`layer2EndsAt`** window to still be open (so admins can fix roster after the cap). **Submitting Layer 2 votes** still requires [`isLayer2VotingOpen`](../lib/layer2-voting.ts) (including `layer2EndsAt` when set).

### Vote queue behavior

- **`fallback_voter`:** only pending groups with **`validityStatus === UNDER_REVIEWED`** in an open Layer 2 window ([`pendingVoteGroupsWhere`](../lib/vote-queue-where.ts)).
- **Participant / `internal_team`:** pending Layer 1 groups while batch is **`VOTING`**, **or** pending **`UNDER_REVIEWED`** groups in an open Layer 2 window.
- **[`submitGroupRatings`](../app/actions/vote.ts)** allows Layer 1 only during **`VOTING`**; Layer 2 supplemental voting on **`UNDER_REVIEWED`** groups when Layer 2 is open.

### Remaining gaps vs PRD

- **Discard / caveat** for groups still below 50% after Layer 2: **manual admin process** only (no automated discard in app).
- **Leaderboard visibility for `fallback_voter`** before publish: not fully locked down; finalist access already blocked for fallback.

---

## Database migration

- Apply [`prisma/migrations/20260415000000_prd_v22_option_a/migration.sql`](../prisma/migrations/20260415000000_prd_v22_option_a/migration.sql) (destructive: drops legacy v1.3 tables if present).
- Apply [`prisma/migrations/20260415120000_batch_internal_voting/migration.sql`](../prisma/migrations/20260415120000_batch_internal_voting/migration.sql) — adds **`INTERNAL_VOTING`** to `BatchStatus`.
- Apply [`prisma/migrations/20260415130000_batch_status_closed/migration.sql`](../prisma/migrations/20260415130000_batch_status_closed/migration.sql) — adds **`CLOSED`** (pre-open) to `BatchStatus`.
- Then `npm run db:seed`.

---

## Gaps / follow-ups vs full PRD v2.2

| Topic | Status |
|-------|--------|
| **ZH / EN (`next-intl`)** | Not implemented — UI strings are English-only for now |
| **Wednesday Layer 2** (UNDER_REVIEWED) | **Implemented:** flagging when entering **`INTERNAL_VOTING`** (cron + admin), [`/admin/under-reviewed`](../app/admin/under-reviewed/page.tsx), assign voters, vote queue + submit rules — see [Layer 2 section](#layer-2--under-reviewed-prd-64). Edge: discard/caveat still manual. |
| **Per-batch `canVote` matrix in admin** | Logic exists; dedicated admin UX can be expanded |
| **Railway + persistent cron** | Documented expectation in PRD; deploy with `CRON_SECRET` hitting the cron route |
| **Award labels on winner cards** | v2.1+ removed per spec; winners are submission-based with scores |

---

*Maintained by engineering alongside schema and routes. If you change user-visible feedback (snackbars, loading, redirect messages), update [`UI-PATTERNS.md`](UI-PATTERNS.md) as well. If you change batch schedule pickers, Shanghai parsing, OPEN→VOTING group preparation, **submission batch resolution**, **normalization**, or **Layer 2 / UNDER_REVIEWED**, update the relevant sections here and [`UI-PATTERNS.md`](UI-PATTERNS.md).*
