# UI patterns — loading states and feedback

**Keep this file in sync** with changes to toast/snackbar behavior, submit-button components, server-action redirect messaging, **admin batch** `datetime-local` / Shanghai handling, or **OPEN→VOTING** group-preparation behavior.

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
- Display and submit use [`lib/datetime-shanghai.ts`](../lib/datetime-shanghai.ts) so wall times match PRD expectations while Prisma stores UTC.
- **Save schedule** uses `FormSubmitButton` with pending label **Saving…**; success/error use redirect toasts via `adminSetBatchSchedule`.

### Prepare voting groups (no dedicated button)

- Group creation and voter assignment for Layer 1 are **not** triggered by a separate admin button. When status moves **OPEN → VOTING** (admin **Set status** or cron), [`prepareBatchIfEnteringVoting`](../lib/voting-assign.ts) runs once if `voterAssignmentDone` is still false — see **[`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md#admin-batches-tab)** for the full flow and code pointers.

---

## Vote queue (`/vote`)

- [`app/vote/page.tsx`](../app/vote/page.tsx) does **not** list pending groups. It picks **one random** incomplete Layer 1 assignment and **`redirect`s** to `/vote/[groupId]`. Users cannot choose order. Returning to `/vote` after a submit repeats random selection among remaining groups. If there are no pending groups, the empty-state message is shown.
- Group scoring uses [`components/star-rating.tsx`](../components/star-rating.tsx) (five stars, dim until chosen) inside [`components/vote-group-form.tsx`](../components/vote-group-form.tsx); all rows must be rated before submit.

---

## Related files (quick reference)

- Server actions: [`app/actions/submit.ts`](../app/actions/submit.ts), [`app/actions/admin.ts`](../app/actions/admin.ts), etc.
- Layout: [`app/layout.tsx`](../app/layout.tsx) uses `Providers`.
