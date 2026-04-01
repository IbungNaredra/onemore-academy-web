# onemore challenge — leaderboard & judging

Web app for the **onemore challenge** program: public schedule and leaderboard, staff authentication, **admin** tools (Google Sheet sync, batches, brackets, judges, scores, published winners), and a **judge** voting queue (+1 / 0 per submission). Data lives in **PostgreSQL** via **Prisma**; the UI is **Next.js** (App Router) with **NextAuth** (credentials).

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router), React |
| Auth | NextAuth v5 (Credentials provider) |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Passwords | bcrypt (users in DB) |
| Integrations | Google Sheets API v4 (`googleapis`) for admin sync |

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
| `DATABASE_URL` | PostgreSQL connection string (includes `?schema=public` if needed) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Defaults for seed + fallback when DB is unavailable |
| `JUDGE_EMAIL` / `JUDGE_PASSWORD` | Same for the sample judge account |
| `NEXT_PUBLIC_GFORM_URL` | Public Google Form link for the main CTA |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Spreadsheet ID from the Google Sheets URL (for admin sync) |
| `GOOGLE_SERVICE_ACCOUNT_JSON_FILE` | **Recommended:** path to service account JSON (e.g. `./google-service-account.json`). Multi-line JSON cannot live in `.env`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Alternative: entire key as **one minified line** |
| `GOOGLE_SHEETS_RANGE` | Optional A1 range; default **`'Form Responses 1'!A:H`**. Use double-quoted env value if needed: `GOOGLE_SHEETS_RANGE="'Form Responses 1'!A:H"` |

**Important:** When `DATABASE_URL` is set and migrated/seeded, sign-in uses **User** rows in the database. The env passwords must match what you hashed in seed (or reset passwords in Admin).

Prisma CLI does not load `.env.local` by default when `prisma.config.ts` exists. This project uses **`prisma.config.ts`** to load `.env` and **`.env.local`** (with override) before Prisma runs, so `npx prisma …` and `npm run db:seed` see `DATABASE_URL` the same way Next.js does.

**Google Sheets:** See **[`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md)** for column mapping, deduplication, batch assignment from col E, and troubleshooting.

---

## Local development

### 1. Start PostgreSQL

Using the bundled Compose file:

```bash
docker compose up -d
```

Default URL (matches `.env.example`):

`postgresql://onemore:onemore@localhost:5432/onemore_challenge?schema=public`

### 2. Install dependencies

```bash
npm install
```

If you hit peer dependency conflicts with `next-auth`, this repo may use **`.npmrc`** with `legacy-peer-deps=true`.

### 3. Push schema and seed

```bash
npx prisma db push
npm run db:seed
```

Seed creates:

- **Admin** and **judge** users (emails/passwords from env or defaults in `prisma/seed.ts`)
- **Three program batches** (`batch-1`, `batch-2`, `batch-3`) with dates; states **Batch 1 = EVALUATING**, **Batch 2 = ACTIVE**, **Batch 3 = UPCOMING** (Batch 1 judging lock cleared)
- **Batch 1 test UGC**: **100** Mini Games + **20** Interactive (`*@bulk-load.onemore.local`, distinct `example.com/bulk-load/...` URLs); seed also clears legacy `*@voting-e2e.onemore.local` rows. Batch 1 **published winners** are cleared; **Google Sheet–synced** submissions in Batch 1 (other emails) are left intact
- **Judge setup for batch-1**: Mini Games and Interactive brackets, all Batch 1 submissions linked to the matching bracket by content type, sample judge assigned to both brackets

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You need **both** the database (if using features that read/write it) and the dev server.

### 5. Google Sheet sync (optional)

1. Configure `GOOGLE_*` variables and place **`google-service-account.json`** (or minify into env — `npm run minify:google-key`).
2. Share the spreadsheet with the service account email.
3. Sign in as admin → **`/admin/submissions`** → **Pull from Google Sheet**.

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint (if configured) |
| `npm run db:generate` | Prisma Client |
| `npm run db:push` | Push schema to DB (dev) |
| `npm run db:migrate` | Migrations (dev) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run minify:google-key` | Print one-line `GOOGLE_SERVICE_ACCOUNT_JSON=` from `google-service-account.json` |

---

## Project layout (main areas)

```
app/
  api/auth/[...nextauth]/route.ts   # NextAuth handlers
  page.tsx                          # Home — schedule from DB
  leaderboard/page.tsx              # Public leaderboard from DB
  login/page.tsx                    # Staff login
  me/page.tsx                       # Redirects admin → /admin, judge → /judge
  judge/page.tsx                    # Judge voting queue (shuffled order, completion banner)
  judge/actions.ts                  # Server actions: submitVote
  admin/page.tsx                    # Admin overview
  admin/judges/page.tsx             # Create / reset judge passwords
  admin/submissions/page.tsx        # GSheet sync, filters, flagged col H, disqualify
  admin/batches/page.tsx            # Batches, brackets, locks, assignments, winners
  admin/batches/[batchId]/results/page.tsx  # Aggregated scores, judge completion, round-robin, vote reset
  admin/actions.ts                  # Server actions (sync + admin + judge assignment)
  globals.css                       # Global styles (including admin / judge)
components/
  site-header.tsx, site-footer.tsx  # Public chrome (footer “Staff” → login)
  schedule-grid.tsx                 # Home schedule UI
  leaderboard-view.tsx              # Leaderboard UI (batch tabs)
  login-form.tsx, sign-out-button.tsx, providers.tsx
  admin-nav.tsx, admin-judge-forms.tsx
lib/
  prisma.ts                         # Prisma client singleton
  guards.ts                         # requireAdmin, requireJudge
  program-batch-public.ts           # Queries for public schedule / leaderboard
  leaderboard-types.ts              # Shared types + batchStateLine
  challenge-data.ts                 # Public config (e.g. GForm URL)
  judge-queue.ts                    # Judge queue (isolated, shuffled rows)
  sheets-sync.ts                    # Google Sheets pull + upsert
  sheet-parsing.ts                  # Col H, dates
  batch-from-declared.ts            # Col E → programBatchId (batch-1/2/3)
  find-batch-for-date.ts            # Optional: batch from timestamp (not used by sync)
  admin-insights.ts                 # Aggregated scores, judge completion, votes list
  bracket-round-robin.ts            # PRD §6: assign submissions to brackets (single pool or round-robin); used by auto-link + results UI
prisma/
  schema.prisma                     # Data model
  seed.ts                           # Seed + demo data + judge brackets
prisma.config.ts                    # Env load order + seed for Prisma CLI
auth.ts                             # NextAuth configuration
types/auth.d.ts                     # Session / JWT (role, id)
scripts/
  minify-service-account-json.mjs   # Helper for one-line service account JSON
legacy-static/                      # Older static prototype (not the Next app)
docker-compose.yml                  # Local Postgres
.env.example                        # Documented env template
docs/
  PRD.md                            # Product requirements (v1.3 + §14 implementation notes)
  GOOGLE-SHEETS.md                  # Sheet sync, columns, env, troubleshooting
```

---

## Data model (summary)

Defined in `prisma/schema.prisma`:

| Model | Role |
|-------|------|
| **User** | Staff: `ADMIN` or `JUDGE`, bcrypt `passwordHash` |
| **ProgramBatch** | Batch windows, `publicState`, optional **`judgingLockedAt`** |
| **Submission** | Creator, UGC URL, `contentType`, `batchSelfDeclared`, optional `programBatchId` (set from **col E** on sync), optional `bracketId` |
| **Bracket** | Pool per batch + content type |
| **JudgeBracketAssignment** | `@@unique([userId, bracketId])` |
| **Vote** | Score **0 or 1**; `@@unique([judgeId, submissionId])` |
| **PublishedWinner** | Admin-published rows for the public leaderboard |

**Deduplication:** `@@unique([creatorEmail, contentUrl])` — one DB row per email + link.

Judges only see submissions that are **in a bracket** they are **assigned** to (and not disqualified).

---

## Routes and behavior

### Public

| Path | Description |
|------|-------------|
| `/` | Challenge schedule (batches from DB), GForm CTA, terms |
| `/leaderboard` | Winners per published batch (batch tabs; Mini vs Interactive) |
| Footer **Staff** | Links to `/login` |

### Staff auth

| Path | Description |
|------|-------------|
| `/login` | Email/password; `callbackUrl` supported |
| `/me` | **admin** → `/admin`, **judge** → `/judge` |

### Admin (role: admin)

| Path | Description |
|------|-------------|
| `/admin` | Overview |
| `/admin/judges` | Create judges, reset passwords |
| `/admin/submissions` | **Sync Google Sheet**, filters, **flagged col H**, **disqualify** |
| `/admin/batches` | Public state, judging lock, brackets, judge assignment, **bulk auto-link submissions → brackets**, optional single-row link override, published winners |
| `/admin/batches/[batchId]/results` | **Aggregated scores**, **per-judge bracket completion**, **round-robin** (per content type), **reset vote** |

Server actions: `app/admin/actions.ts` (includes `syncGoogleSheet`, `autoLinkBatchSubmissions`, bracket actions, etc.).

#### Linking many submissions to brackets (admin)

After **Google Sheet sync** (or any import), each row needs a **`bracketId`** so judges see it. Linking one submission at a time does not scale past a handful of rows.

On **`/admin/batches`**, for each program batch:

1. Create at least one **bracket** per content type you need (**Mini Games**, **Interactive Content**).
2. Use **Auto-link all submissions**. That runs the same distribution as **PRD §6**: every non-disqualified submission in the batch is assigned to a bracket that matches its **content type**. If there is **only one bracket** for that type, all matching rows go to that pool. If there are **several brackets** for the same type, rows are spread **round-robin** across them (same logic as **Round-robin (PRD §6)** on **`/admin/batches/[batchId]/results`** — *Redistribute Mini Games* / *Redistribute Interactive*).
3. Use **Link one submission (override)** only for exceptions (e.g. moving one row to a different pool).

Submissions stay unlinked if there is **no bracket** for their content type—create the bracket first, then auto-link again.

### Judge (role: judge)

| Path | Description |
|------|-------------|
| `/judge` | Isolated queue: **Good (+1)** / **Neutral (0)**; shuffled order; completion banner; respects batch lock |

`app/judge/actions.ts` — `submitVote`.

---

## Authentication details

- **`lib/guards.ts`**: `requireAdmin()`, `requireJudge()`.
- Session: **`role`**, **`id`** (JWT `sub`) for DB alignment.
- If the DB is unreachable, `auth.ts` may fall back to env-only credentials (dev only).

---

## Prisma / Windows notes

- If `prisma generate` fails with **EPERM** on Windows, close processes using `node_modules/.prisma` and retry.

---

## Legacy static site

`legacy-static/` — old HTML/JS prototype. The app lives under `app/`.

---

## Documentation index

| Document | Contents |
|----------|----------|
| **[`docs/PRD.md`](docs/PRD.md)** | Full PRD v1.3 — background, scope, §8 features, columns A–H, NFR, **§14 implementation status** |
| **[`docs/GOOGLE-SHEETS.md`](docs/GOOGLE-SHEETS.md)** | Sheet sync setup, column mapping, dedupe, col E batch mapping, troubleshooting |

The Word source may be `onemore_challenge_web_prd_v1.3.docx`. Repo markdown may diverge where implementation choices are documented (e.g. batch from col E — see PRD §7 notes in `docs/PRD.md`).
