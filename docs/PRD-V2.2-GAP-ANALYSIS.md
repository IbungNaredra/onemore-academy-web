# PRD v2.2 — Gap analysis vs `onemore-academy-web`

> **Status (2026):** Option A is **implemented**. For live routes, schema, and remaining gaps, use **[PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md)**. The tables below describe the **pre-v2.2** codebase vs the spec and remain useful for historical comparison.

**Audience:** Originally written for engineering planning before the v2.2 build.

**Sources:** PRD v2.2 (`onemore_challenge_prd_v2.2.docx`), legacy [PRD.md](./PRD.md) (v1.3), [prisma/schema.prisma](../prisma/schema.prisma).

---

## 1. Snapshot: repo **before** v2.2 (historical)

| Area | Former implementation (v1.3) |
|------|-------------------------|
| **Stack** | Next.js App Router, React, Prisma, PostgreSQL, NextAuth (credentials), Tailwind |
| **Roles** | `ADMIN`, `JUDGE` only |
| **Submissions** | `Submission` synced from Google Sheet; `creatorEmail` + `contentUrl` unique; batch from col E |
| **Voting** | `Vote`: +1/0 per judge per submission; `JudgeBracketAssignment` → `Bracket` |
| **Batch UX** | `ProgramBatch` + `BatchPublicState`; manual lock / publish via admin |
| **Public** | Home (`/`), leaderboard (`/leaderboard`) — no public numeric scores per v1.3 |
| **API routes** | Effectively NextAuth only under `app/api/auth/` |
| **Cron** | None |

---

## 2. PRD v2.2 target (condensed)

- **Users:** Self-registration; `@garena` email; division enum (22); roles `PARTICIPANT`, `FALLBACK_VOTER`, `INTERNAL_TEAM`, `ADMIN`.
- **Batches:** `OPEN` | `VOTING` | `CONCLUDED`; auto transitions UTC+8; per-batch auto-toggle + date/time pickers + manual override.
- **Submissions:** In-app; HTTPS URL + HTTP 200 check; duplicate URL per batch; edit/delete only in OPEN; admin disqualify.
- **Voting:** Layer 1 (Tuesday): participants with `canVote` rate assigned **groups** 1–5, **all-or-nothing** per group. Layer 2 (Wednesday): `UNDER_REVIEWED` groups + internal/fallback voters. Layer 3: finalist pool, admin picks winners by **16:00** Wed.
- **Scoring:** Normalized scores; finalist top 10 per category; published winners on leaderboard **with** normalized score and **email**.
- **i18n:** ZH default, EN toggle (`next-intl` suggested).
- **Jobs:** Railway cron for batch transitions; Neon not auto-suspend.
- **Out of scope:** GSheet sync, OAuth, email verification, self-service password reset (admin reset only).

---

## 3. Route map

| PRD v2.2 route | Purpose | Current repo |
|----------------|---------|--------------|
| `/auth` | Login + register | **`/login`** only; no registration |
| `/info` | Challenge information | **`/`** (home) — merge/rename |
| `/leaderboard` | Public winners + internal Top 10 (role-gated) | **`/leaderboard`** — different data rules (no emails/scores on public cards today) |
| `/` home | Vote tab (auth) | **`/judge`** — different UX (staff queue, not participant groups) |
| `/submit` | UGC submission | **Missing** (Sheet only) |
| `/vote/[groupId]` | Group voting | **Missing** (replaces per-judge queue model) |
| `/finalist` | Finalist pool (admin + internal team) | **Missing** |
| `/admin` | Overview | **`/admin`** |
| `/admin/users` | Users, roles, `canVote`, password | **`/admin/judges`** (judges only, no self-reg users) |
| `/admin/batch` | Batch status, cron config, transitions | **`/admin/batches`** — different state machine |
| `/admin/submissions` | Submissions, UNDER_REVIEWED, assign voters | **`/admin/submissions`** — Sheet-centric |
| `/admin/winners` | Finalist + publish | Split today: **`/admin/batches`**, **`.../results`** |

**Gap (historical):** Pre-v2.2, almost every route needed **new handlers** or **replacement** behavior. **After Option A**, see **[PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md)**.

---

## 4. Data model gap (v2.2 §14 vs Prisma)

| v2.2 concept | Former model (pre-v2.2) | Engineering note (historical) |
|--------------|---------------|-------------------------|
| `User` with `division`, `role` enum (4 values), `passwordHash` | `User`: `ADMIN`/`JUDGE`, no division | New enum + fields; migration strategy for existing judge accounts |
| `Batch`: `openAt`, `votingAt`, `concludedAt`, `autoTransition`, `status`, `voterAssignmentDone` | `ProgramBatch`: dates + `publicState` + judging flags | Replace or parallel schema; cron keys off new fields |
| `Submission`: `userId`, `category`, `status` ACTIVE/DISQUALIFIED, `normalizedScore`, `totalRatingsReceived` | `Submission`: sheet fields, `bracketId`, no `userId` | **New submission model** or heavy refactor; drop Sheet as source |
| `ContentGroup`, `GroupSubmission`, `GroupVoterAssignment`, `Rating` | `Bracket`, `JudgeBracketAssignment`, `Vote` | **New tables** — group voting ≠ judge brackets |
| `BatchVoterEligibility` (`canVote` per batch) | None | **New** |
| `PublishedWinner` | `PublishedWinner` + award name | Extend: v2.2 may drop “award label” emphasis; add score display fields if needed |

**Vote semantics (historical):** Old `Vote` was judge +1/0. v2.2 `Rating` is 1–5, unique `(submissionId, voterId)`, group submit — **replaced** in the current schema.

---

## 5. Story → backend → UI (v2.2)

### Epic A — Identity

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Register with email, password, name, division | `POST` register; validate `@garena`; bcrypt; Prisma create | `/auth` register form |
| Login | Existing NextAuth pattern; extend session with `role`, `id` | `/auth` |
| Admin reset password | `POST` admin action | `/admin/users` |

### Epic B — Batch lifecycle

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Auto transition OPEN → VOTING → CONCLUDED | Cron job UTC+8; idempotent transitions | `/admin/batch` status + toggles |
| Manual override | Admin mutation on `Batch.status` | Same |
| Voter assignment gate | Flag `voterAssignmentDone`; block bad transitions | Warning UI |

### Epic C — Submissions

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Submit URL in OPEN | Validate HTTPS + HEAD/GET 200; dedupe per batch | `/submit` |
| Edit/delete in OPEN | Mutations; revoke `canVote` if no active subs | `/submit` list |
| Disqualify | Admin | `/admin/submissions` |

### Epic D — Group formation & Layer 1 voting

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Run group-size algorithm (v2.2 §6.2) | Server module + persistence in `ContentGroup` | Admin trigger before VOTING |
| Assign voters to groups | `GroupVoterAssignment` | Admin + participant “my groups” |
| Submit all ratings for group atomically | Transaction: N `Rating` rows + complete assignment | `/vote/[groupId]` |

### Epic E — Wednesday flows

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Flag UNDER_REVIEWED at Wed 00:00 | Job + `ContentGroup.validityStatus` | `/admin/submissions` |
| Assign internal/fallback to groups | Mutations | Admin |
| Finalist pool top 10 | Query + normalization | `/finalist`, `/admin/winners` |

### Epic F — Leaderboard

| Story | API / server needs | UI |
|-------|-------------------|-----|
| Public winner cards | Public read | `/leaderboard` |
| Top 10 internal section | Server component auth check | Same page, gated |

### Epic G — i18n

| Story | API / server needs | UI |
|-------|-------------------|-----|
| ZH/EN | `next-intl` or equivalent; JSON from CSV pipeline | App-wide provider + toggle |

---

## 6. Cron / infrastructure

| Job | Schedule (v2.2) | Current |
|-----|-----------------|--------|
| Batch transition | Per batch `openAt`, `votingAt`, `concludedAt` (UTC+8) | None |
| Wednesday 00:00 evaluation | UNDER_REVIEWED compilation | None |

**Gap:** Requires **always-on** worker (PRD: Railway) + verified timezone. Vercel cron may be insufficient for all edge cases — confirm with DevOps.

---

## 7. Non-functional / compliance

- **Email on public leaderboard:** Conflicts with v1.3 “internal reference only” for email — **legal/PR sign-off**.
- **HTTP 200 ping:** CDN blocking risk — v2.2 open item; fallback to URL format-only validation.
- **Translation process:** Block UI string freeze until CSV ~80% (per v2.2).

---

## 8. Estimated reuse from this repo

| Reuse | Notes |
|-------|--------|
| Next.js + Prisma + NextAuth pattern | High — patterns transfer |
| Tailwind layout / brand | Partial — v2.2 specifies dark + gradient cards |
| `lib/guards.ts` role checks | Rewrite for 4 roles + `canVote` |
| Admin page shells | Structural reuse only |
| `lib/sheets-sync.ts`, GSheet admin | **Remove** from critical path if v2.2 is authoritative |
| Judge queue / vote components | **Low** — different UX and data |

---

## 9. Suggested implementation order (if Option A)

1. Schema + migrations (User, Batch, Submission, groups, ratings, eligibility).
2. Auth + registration + admin user management.
3. Batch admin + cron + transition jobs (test with fake clocks).
4. Submit + disqualify.
5. Group algorithm + voter assignment + Layer 1 voting UI.
6. Wednesday jobs + UNDER_REVIEWED + Layer 2.
7. Finalist + winner publish.
8. Leaderboard + gated Top 10.
9. i18n pass.

---

## 10. Traceability

| PRD v2.2 section | This doc |
|------------------|----------|
| §2 Program timeline | §2, §6 |
| §3 Roles | §4, Epic A |
| §4–5 Auth / submission | Epic A, C |
| §6 Voting | Epic D, E |
| §11 IA / routes | §3 |
| §12–13 Leaderboard / admin | Epic F, §3 |
| §14 Data model | §4 |
| §15 Tech stack | §1, §6 |

*End of gap analysis.*
