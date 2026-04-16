# onemore challenge — voting website (PRD v2.2)

Web app for **onemore Internal Testing** (PRD v2.2): **self-registration** (Garena email), **in-app UGC submissions**, **group-based voting** (1–5, all-or-nothing per group), **normalized scores**, and a **public leaderboard** (with optional internal Top 10). **Admin** manages users, batch lifecycle, voter assignment prep, disqualifications, and publishing winners. **No Google Sheets or Google Forms** — data is **PostgreSQL** via **Prisma**; UI is **Next.js** (App Router) with **NextAuth** (credentials).

**Docs:** [`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md) (what ships vs the spec), [`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md) (loading states, snackbars, submit buttons), [`docs/README.md`](docs/README.md) (index). Historical **v1.3** PRD: [`docs/PRD.md`](docs/PRD.md).

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router), React |
| Auth | NextAuth v5 (Credentials provider) |
| Database | PostgreSQL |
| ORM | Prisma |
| Passwords | bcrypt (`User.passwordHash`) |

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **Docker** (optional) for local PostgreSQL — or any hosted Postgres URL

---

## Environment variables

Copy `.env.example` to `.env.local` and adjust values.

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Secret for NextAuth session signing (long random string) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed admin user (must match seed after `db:seed`) |
| `TEST_PARTICIPANT_PASSWORD` | Optional: password for seeded load-test UGC users (`test.ugc.p*@garena.com`) |
| `TEST_INTERNAL_TEAM_PASSWORD` | Optional: password for seeded internal team test users (`internal.team.it*@garena.com`) |
| `CRON_SECRET` | Optional: `Authorization: Bearer` for `GET /api/cron/batch-transitions` |

**Important:** When `DATABASE_URL` is set and migrated/seeded, sign-in uses **User** rows in the database.

Prisma CLI loads `.env` / `.env.local` via **`prisma.config.ts`** (override from `.env.local`) so `npx prisma …` and `npm run db:seed` see `DATABASE_URL` the same way Next.js does.

### Deploying (e.g. Vercel)

1. Use **hosted PostgreSQL**. **`localhost` in `DATABASE_URL` will not work** on serverless hosts.
2. Set **`AUTH_SECRET`**, **`DATABASE_URL`**, and optionally **`AUTH_URL`** (`https://<project>.vercel.app`).
3. Run **`npx prisma migrate deploy`** (or `db push` for a throwaway DB), then **`npm run db:seed`** if you need seeded users/batches.

---

## Local development

### 1. Start PostgreSQL (optional)

```bash
docker compose up -d
```

Example URL: `postgresql://onemore:onemore@localhost:5432/onemore_challenge?schema=public`

### 2. Install dependencies

```bash
npm install
```

### 3. Migrate and seed

```bash
npx prisma migrate deploy
npm run db:seed
```

Apply all migrations in `prisma/migrations/` in order (base schema, then `INTERNAL_VOTING` and `CLOSED` enum values if present). `migrate deploy` applies the full chain.

Seed creates:

- **Admin** user (default `admin.onemorechallenge@garena.com` / `admin123` unless overridden by env)
- **Demo participant** (`participant.demo@garena.com` / `participant123`)
- **Three batches** (`batch-1` … `batch-3`) with PRD-style May 2026 dates — each is explicitly set to **`OPEN`** (schema default for new rows is **`CLOSED`**)
- One **demo submission** on Batch 1 for the demo participant
- **Load-test UGC cohort:** 20 participants `test.ugc.p01@garena.com` … `test.ugc.p20@garena.com` (password `test123456` or `TEST_PARTICIPANT_PASSWORD`) — **10× Mini Games + 10× Real Life + Prompt** on Batch 1 (one UGC each)
- **No-UGC voters:** 5 participants `test.nosub.p01@garena.com` … `test.nosub.p05@garena.com` (same password) — eligible to vote on Batch 1, **no** submission
- **Internal team:** 10 users `internal.team.it01@garena.com` … `internal.team.it10@garena.com` (password `12345678` or `TEST_INTERNAL_TEAM_PASSWORD`) for Layer 2 / finalist / Top 10 testing

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — `/` redirects to `/info` or `/vote` when signed in.

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Prisma Client |
| `npm run db:push` | Push schema (dev) |
| `npm run db:migrate` | Migrations (dev) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:reset-ugc` | **Destructive:** delete all UGC (submissions, groups, ratings, winners, eligibility) and all users except `ADMIN` — see `scripts/reset-nonadmin-and-ugc.ts` |

---

## Project layout (main areas)

```
app/
  api/auth/[...nextauth]/route.ts    # NextAuth
  api/auth/register/route.ts         # Self-registration
  api/cron/batch-transitions/route.ts # Optional cron (CRON_SECRET)
  actions/                           # Server actions: submit, vote, admin
  auth/page.tsx                      # Login + register
  info/page.tsx                      # Challenge info + schedule
  submit/page.tsx                    # UGC submission
  vote/page.tsx, vote/[groupId]/     # Group voting
  leaderboard/page.tsx               # Winners + internal Top 10
  finalist/page.tsx                  # Internal finalist view
  admin/                             # Users, batch, submissions, winners, under-reviewed
lib/
  group-algorithm.ts, voting-assign.ts, eligibility.ts, scoring.ts
  batch-jobs.ts, layer2-voting.ts, vote-queue-where.ts, under-reviewed-metrics.ts
  url-check.ts, divisions.ts, program-batch-public.ts, snackbar-url.ts
prisma/
  schema.prisma, migrations/, seed.ts
auth.ts                              # NextAuth (DB users only)
types/next-auth.d.ts
docs/
  PRD-V2.2-IMPLEMENTATION.md         # Current implementation status
  UI-PATTERNS.md                      # Loading states, snackbars, submit buttons
  PRD.md                             # Historical v1.3 PRD
  GOOGLE-SHEETS.md                   # Deprecated (v1.3 only)
components/
  snackbar-context.tsx, snackbar-from-search-params.tsx, form-submit-button.tsx, providers.tsx
  schedule-grid.tsx, leaderboard-view.tsx, layer2-voter-assign-form.tsx, publish-winners-form.tsx
```

---

## Data model (summary)

See [`prisma/schema.prisma`](prisma/schema.prisma): **User** (roles + division), **ProgramBatch** (`CLOSED` / `OPEN` / `VOTING` / `INTERNAL_VOTING` / `CONCLUDED`, transition timestamps; default **`CLOSED`**), **Submission** (per user + batch, `batchId` + `contentUrl` unique), **ContentGroup** / **GroupSubmission** / **GroupVoterAssignment** / **Rating**, **BatchVoterEligibility**, **PublishedWinner**.

---

## Routes (high level)

| Path | Description |
|------|-------------|
| `/info` | Challenge info, schedule |
| `/auth` | Login + register |
| `/submit` | Submissions (batch OPEN) |
| `/vote` | Vote queue |
| `/leaderboard` | Public leaderboard + internal section (role-gated) |
| `/admin/*` | Admin panel (includes **`/admin/under-reviewed`** — Layer 2 UNDER_REVIEWED) |

Full table: [`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md).

---

## Authentication

- **`lib/guards.ts`**: `requireAdmin`, `requireInternalOrAdmin`, `requireSession`, etc.
- Session includes **`role`** (`admin` | `participant` | `fallback_voter` | `internal_team`) and **`id`**.

---

## UI feedback (loading + toasts)

- **Snackbar:** `SnackbarProvider` / `useSnackbar()` in [`components/snackbar-context.tsx`](components/snackbar-context.tsx); mounted from [`components/providers.tsx`](components/providers.tsx).
- **After redirects:** [`lib/snackbar-url.ts`](lib/snackbar-url.ts) (`buildToastUrl`) + [`components/snackbar-from-search-params.tsx`](components/snackbar-from-search-params.tsx) for `toast` / `toastDescription` query params.
- **Server forms:** [`components/form-submit-button.tsx`](components/form-submit-button.tsx) uses `useFormStatus()` for pending labels.
- **Convention:** When changing any of the above, update **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md)**.

### Admin — Batches (`/admin/batch`)

- **Schedule:** Native **`datetime-local`** inputs; times are edited as **Asia/Shanghai** and stored as UTC — see [`lib/datetime-shanghai.ts`](lib/datetime-shanghai.ts) and **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md#admin-batches-tab)**.
- **Voting groups:** There is no separate “prepare voting” control. On **OPEN → VOTING** (manual status change or cron with `autoTransition`), the app runs group + voter assignment once if needed — **[`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md#admin-batches-tab)**.
- **Which batch a submission uses** (OPEN + date window) and **how normalized scores update**: **[`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md#which-batch-gets-new-submissions-batchid)** · **[`#normalized-scores-when-they-update-vs-what-pages-read`](docs/PRD-V2.2-IMPLEMENTATION.md#normalized-scores-when-they-update-vs-what-pages-read)** · **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md#notes--batch-assignment--normalized-scores)** (short notes).
- **Layer 2 (UNDER_REVIEWED):** at end of peer voting, **incomplete Layer 1 peer assignments are removed** (no-shows out of the 50% denominator), then **`UNDER_REVIEWED`** flagging; cron + manual status change; **`/admin/under-reviewed`**; vote queue rules for **fallback** vs others — **[`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md#layer-2--under-reviewed-prd-64)**.

### Public batch schedule (`/info`, `/leaderboard`)

- **Challenge info** embeds [`components/schedule-grid.tsx`](components/schedule-grid.tsx); data comes from [`lib/program-batch-public.ts`](lib/program-batch-public.ts) (`getScheduleBatches`).
- **State mapping** lives in [`lib/leaderboard-types.ts`](lib/leaderboard-types.ts): `PublicBatchState`, `batchStateDisplayName` (short pill text), `batchStateLine` (sentence under the leaderboard week picker).
- **Pill labels:** e.g. **Closed** (`CLOSED`), **Open**, **Voting** — both peer voting (`VOTING`) and internal/Layer 2 phase (`INTERNAL_VOTING`) use the short label **Voting** on the schedule pill (longer copy in `batchStateLine` still distinguishes internal voting where relevant).
- **`CLOSED`** batches show a dedicated empty state on the leaderboard until the batch opens. See **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md#challenge-info--batch-schedule-public)**.

---

## Prisma / Windows notes

- If `prisma generate` fails with **EPERM** on Windows, close processes using `node_modules/.prisma` and retry.

---

## Legacy static site

`legacy-static/` — old HTML prototype. The app lives under `app/`.

---

## Documentation index

| Document | Contents |
|----------|----------|
| **[`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md)** | **Current** — routes, schema, gaps; **`CLOSED` / `INTERNAL_VOTING`** lifecycle; submission **`batchId`**; normalized scores; Layer 2 / UNDER_REVIEWED |
| **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md)** | Snackbars, `FormSubmitButton`, admin batches, **public schedule pills**, vote queue (L1 vs L2), under-reviewed voter picker |
| **[`docs/README.md`](docs/README.md)** | Doc folder index |
| **[`docs/STAKEHOLDER-DECISION-PRD-V2.2.md`](docs/STAKEHOLDER-DECISION-PRD-V2.2.md)** | Option A record |
| **[`docs/PRD.md`](docs/PRD.md)** | Historical **v1.3** PRD (judge + Sheet) |
| **[`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md)** | **Deprecated** — v1.3 Sheet sync only |
