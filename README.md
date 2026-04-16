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

Seed creates:

- **Admin** user (default `admin.onemorechallenge@garena.com` / `admin123` unless overridden by env)
- **Demo participant** (`participant.demo@garena.com` / `participant123`)
- **Three batches** (`batch-1` … `batch-3`) with PRD-style May 2026 dates, status **OPEN**
- One **demo submission** on Batch 1 for the demo participant

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
  admin/                             # Users, batch, submissions, winners
lib/
  group-algorithm.ts, voting-assign.ts, eligibility.ts, scoring.ts
  batch-jobs.ts, url-check.ts, divisions.ts, program-batch-public.ts, snackbar-url.ts
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
```

---

## Data model (summary)

See [`prisma/schema.prisma`](prisma/schema.prisma): **User** (roles + division), **ProgramBatch** (`OPEN` / `VOTING` / `CONCLUDED`, transition timestamps), **Submission** (per user + batch, `batchId` + `contentUrl` unique), **ContentGroup** / **GroupSubmission** / **GroupVoterAssignment** / **Rating**, **BatchVoterEligibility**, **PublishedWinner**.

---

## Routes (high level)

| Path | Description |
|------|-------------|
| `/info` | Challenge info, schedule |
| `/auth` | Login + register |
| `/submit` | Submissions (batch OPEN) |
| `/vote` | Vote queue |
| `/leaderboard` | Public leaderboard + internal section (role-gated) |
| `/admin/*` | Admin panel |

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
| **[`docs/PRD-V2.2-IMPLEMENTATION.md`](docs/PRD-V2.2-IMPLEMENTATION.md)** | **Current** — routes, schema, gaps vs PRD v2.2 |
| **[`docs/UI-PATTERNS.md`](docs/UI-PATTERNS.md)** | Loading states, snackbars, `FormSubmitButton`, URL toasts, admin batch pickers |
| **[`docs/README.md`](docs/README.md)** | Doc folder index |
| **[`docs/STAKEHOLDER-DECISION-PRD-V2.2.md`](docs/STAKEHOLDER-DECISION-PRD-V2.2.md)** | Option A record |
| **[`docs/PRD.md`](docs/PRD.md)** | Historical **v1.3** PRD (judge + Sheet) |
| **[`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md)** | **Deprecated** — v1.3 Sheet sync only |
