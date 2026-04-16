# UI patterns — loading states and feedback

**Keep this file in sync** with changes to toast/snackbar behavior, submit-button components, server-action redirect messaging, **admin batch** `datetime-local` / Shanghai handling, **`CLOSED`→`OPEN` and `OPEN`→`VOTING`** transitions and group-preparation behavior, **public schedule** (`ScheduleGrid`, batch state pills), **which batch receives submissions**, **normalized score** behavior, or **Layer 2 / UNDER_REVIEWED** (vote queue rules, admin under-reviewed).

---

## Snackbar (in-app toasts)

| Piece | Role |
|-------|------|
| [`components/snackbar-context.tsx`](../components/snackbar-context.tsx) | `SnackbarProvider` + `useSnackbar()` (`showSuccess`, `showError`) |
| [`components/providers.tsx`](../components/providers.tsx) | Wraps the app with `SnackbarProvider` (and `SnackbarFromSearchParams`) |

Client components call `useSnackbar()` for immediate feedback (e.g. auth errors, vote submit).

---

## URL toasts (after server actions + `redirect`)

Server actions often end with `redirect(buildToastUrl(...))` so the next page shows a snackbar once.

| Piece | Role |
|-------|------|
| [`lib/snackbar-url.ts`](../lib/snackbar-url.ts) | `buildToastUrl(path, "success" \| "error", description?)` — sets `toast` and optional `toastDescription` query params |
| [`components/snackbar-from-search-params.tsx`](../components/snackbar-from-search-params.tsx) | On load, reads `toast` / `toastDescription`, shows the snackbar, then `router.replace`s to strip those params |

Admin and submit flows use this pattern so users see success or error text without leaving query cruft in the address bar.

---

## Submit buttons and loading UI

| Pattern | When to use |
|---------|-------------|
| **`FormSubmitButton`** ([`components/form-submit-button.tsx`](../components/form-submit-button.tsx)) | Inside a `<form>` that uses a **server action** (`action={...}`). Uses React `useFormStatus()` so the label switches to `pendingLabel` (default `Working…`) while the request is in flight. |
| **Manual `pending` + `form-submit-btn--pending`** | Client-only submits (`onSubmit` handlers): auth, vote group, sign-out, etc. Disable the control, set `aria-busy`, swap label text, add class `form-submit-btn--pending`. |
| **CSS** | [`app/globals.css`](../app/globals.css) — `.form-submit-btn--pending` (e.g. cursor `wait`, reduced opacity). |

**Do not** use `FormSubmitButton` outside a form ancestor (e.g. not for a standalone `type="button"`). Tab toggles and the snackbar dismiss control stay as plain `type="button"` without async loading unless they perform async work.

---

## Admin Batches tab

**Route:** [`app/admin/batch/page.tsx`](../app/admin/batch/page.tsx).

### Date / time pickers (schedule)

- Fields are HTML **`datetime-local`** inputs (browser-native picker + keyboard entry). Labels describe **Asia/Shanghai (UTC+8)**.
- The **Peer voting ends** field maps to `concludedAt` (cron moves **`VOTING` → `INTERNAL_VOTING`** at that instant when `autoTransition` is on).
- Display and submit use [`lib/datetime-shanghai.ts`](../lib/datetime-shanghai.ts) so wall times match PRD expectations while Prisma stores UTC.
- **Save schedule** uses `FormSubmitButton` with pending label **Saving…**; success/error use redirect toasts via `adminSetBatchSchedule`.
- **Set status** lists all `BatchStatus` values with short descriptions (e.g. **`CLOSED`** — competition not open yet; **`INTERNAL_VOTING`** — under review & Layer 2).

### Prepare voting groups (no dedicated button)

- Group creation and voter assignment for Layer 1 are **not** triggered by a separate admin button. When status moves **OPEN → VOTING** (admin **Set status** or cron), [`prepareBatchIfEnteringVoting`](../lib/voting-assign.ts) runs once if `voterAssignmentDone` is still false — see **[`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md#admin-batches-tab)** for the full flow and code pointers.

### Admin Users — `FALLBACK_VOTER` role ([`/admin/users`](../app/admin/users/page.tsx))

- When admin saves a user’s role as **`FALLBACK_VOTER`**, [`adminSetUserRole`](../app/actions/admin.ts) upserts **`BatchVoterEligibility`** for **every** `ProgramBatch` with **`canVote: true`** and **`adminOverride: true`**, so the user is eligible for voter assignment (including Layer 2) without manual per-batch toggles.
- Changing **away** from **`FALLBACK_VOTER`** clears **`adminOverride`** on that user’s eligibility rows and runs [`recomputeCanVote`](../lib/eligibility.ts) per batch so participants / internal team rules apply again.

### Admin — Publish winners (`/admin/winners`)

- [`components/publish-winners-form.tsx`](../components/publish-winners-form.tsx) — searchable multi-select (same combobox styling as Layer 2 voter assign) over **all active** submissions in the batch; hidden `name="ids"` fields; **Publish** disabled until at least one row is selected.
- Server action [`adminPublishWinners`](../app/actions/admin.ts) rejects an empty selection with a toast error.

---

## Challenge info — batch schedule (public)

**Route:** [`app/info/page.tsx`](../app/info/page.tsx) embeds [`components/schedule-grid.tsx`](../components/schedule-grid.tsx).

- Data is loaded with [`getScheduleBatches`](../lib/program-batch-public.ts) (same DTO shape as leaderboard schedule lines).
- Each row shows submission period, evaluation (`concludedAt`), optional announcement (`leaderboardPublishAt`), and a **state pill**.
- **Pill text** comes from [`batchStateDisplayName`](../lib/leaderboard-types.ts) (`PublicBatchState`: `closed` | `open` | `voting` | `internal_voting` | `concluded` | `published`). **`internal_voting`** uses the short label **Voting** (same word as peer **`voting`**) so the grid stays compact; longer copy is in **`batchStateLine`** on the leaderboard.
- **CSS** in [`app/globals.css`](../app/globals.css): `.state-closed`, `.state-active`, `.state-evaluating`, `.state-published` (see [`stateClass`](../components/schedule-grid.tsx) in `schedule-grid.tsx`).

**Leaderboard** ([`components/leaderboard-view.tsx`](../components/leaderboard-view.tsx)): uses **`batchStateLine`** under the week picker; batches in **`closed`** show a dedicated “Competition not open yet” card instead of “Results not published yet”.

---

## Vote queue (`/vote`)

- [`app/vote/page.tsx`](../app/vote/page.tsx) does **not** list pending groups. It picks **one random** pending group (see below) and **`redirect`s** to `/vote/[groupId]`. On success, [`components/vote-group-form.tsx`](../components/vote-group-form.tsx) uses **`window.location.assign("/vote")`** for the next task.
- **Which groups appear** is defined by [`lib/vote-queue-where.ts`](../lib/vote-queue-where.ts) (`pendingVoteGroupsWhere`):
  - **`fallback_voter`:** only **`UNDER_REVIEWED`** groups while Layer 2 is open (`INTERNAL_VOTING`, **`winnersPublishedAt`** null, not past **`layer2EndsAt`** — see [`lib/layer2-voting.ts`](../lib/layer2-voting.ts)).
  - **Participant / `internal_team`:** Layer 1 while batch is **`VOTING`**, or **`UNDER_REVIEWED`** in an open Layer 2 window.
- Group scoring uses [`components/star-rating.tsx`](../components/star-rating.tsx) (five stars) until every row is rated.

### Admin — UNDER_REVIEWED (`/admin/under-reviewed`)

- Lists **`UNDER_REVIEWED`** groups (batch **`INTERNAL_VOTING`** or **`CONCLUDED`**), **Recalculate** for those batches, and **assign** internal team / fallback voters via a **searchable multi-select** ([`components/layer2-voter-assign-form.tsx`](../components/layer2-voter-assign-form.tsx)); server actions: [`app/actions/admin.ts`](../app/actions/admin.ts) `adminAssignLayer2Voters`, `adminReevaluateUnderReviewed`. **50% completion** uses the **full peer roster** at end of peer voting **before** incomplete no-shows are removed ([`flagUnderReviewedGroups`](../lib/batch-jobs.ts) snapshot). Full behavior: **[`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md#layer-2--under-reviewed-prd-64)**.

---

## Notes — batch assignment & normalized scores

Short reference; full detail: **[`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md#which-batch-gets-new-submissions-batchid)** and **[`#normalized-scores-when-they-update-vs-what-pages-read`](PRD-V2.2-IMPLEMENTATION.md#normalized-scores-when-they-update-vs-what-pages-read)**.

### Which `batchId` on submit

- [`lib/submission-batch.ts`](../lib/submission-batch.ts) **`resolveSubmissionBatch`**: among batches with **`status === OPEN`**, pick the first (by **`batchNumber`**) where **`openAt <= now < votingAt`**. Users do not pick the batch manually.

### Normalized scores

- [`lib/scoring.ts`](../lib/scoring.ts) **`refreshNormalizedScoresForBatchCategory`** runs after a successful group vote ([`app/actions/vote.ts`](../app/actions/vote.ts)). **`Submission.normalizedScore`** is updated in the DB; finalist / leaderboard views **read** those stored values (no per-request recomputation of the min–max formula on list pages).

---

## Related files (quick reference)

- Server actions: [`app/actions/submit.ts`](../app/actions/submit.ts), [`app/actions/admin.ts`](../app/actions/admin.ts), etc.
- Layout: [`app/layout.tsx`](../app/layout.tsx) uses `Providers`.
