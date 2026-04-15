# onemore Challenge — Web & Voting System

**Product Requirements Document** · **v1.3** · April 2026  

> **Repository status:** The **current product** is **PRD v2.2 Option A** (participant voting, in-app submissions, no Google Sheet sync). This document remains the **v1.3** historical spec (judge + Sheet workflow). See **[`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md)** for what the code implements today and **[§15](#15-supersession-by-prd-v22)** below.

| | |
|---|---|
| **Author** | Ibung (Product Ops, Indonesia) |
| **Status** | Draft — Pending Review *(v1.3 lineage; superseded in codebase by v2.2 — see §15)* |
| **Program period** | 30 April – 22 May 2026 |
| **Stakeholders** | Shanghai Ops (Tracy), Indonesia Ops, Product Team |
| **Last updated** | March 2026 |
| **Version notes (v1.3)** | Revised scoring, bracket logic, GSheet mapping, winner structure |

*This markdown is derived from `onemore_challenge_web_prd_v1.3.docx` for repository documentation.*

---

## 1. Background & Problem

**onemore Academy – Internal Testing** is a 1-month internal challenge running from **30 April to 29 May 2026**. Participants (primarily Garenians / Shanghai internal team) create interactive, prompt-based content on the onemore platform and submit via Google Form. Each week, a group of judges scores submissions and winners are announced publicly.

Currently, the judging workflow relies entirely on a shared Google Spreadsheet. This creates several problems:

- **No access control** — all judges can see all submissions and each other’s scores, which biases voting.
- **No structured distribution** — manually slicing rows to assign batches per judge is error-prone.
- **No public-facing surface** — winners are announced via internal chat, not a persistent leaderboard.
- **No audit trail** — score changes are invisible and unverifiable.

This web system replaces the manual judging process and provides a public leaderboard that also serves as a lightweight external showcase of what onemore can produce.

---

## 2. Objectives

1. Replace the manual GSheet judging workflow with a structured, access-controlled voting system.
2. Give each judge a **clean, isolated queue** — they cannot see other judges’ scores.
3. Separate **Mini Games** and **Interactive Content** into **two independent bracket systems** — content types are never compared against each other.
4. Publish a **weekly leaderboard** split by content type: **2 winners per type, 4 winners total per batch**.
5. Keep operational burden on Ibung minimal — **data syncs from GSheets**, no manual entry.
6. Keep the system as **lean** as possible to minimize bug surface.

---

## 3. Scope

### In scope

- Public-facing **challenge information page (Page 1)**  
- Public-facing **weekly leaderboard** split by content type **(Page 2)**  
- **Admin login** and **judge management**  
- **Judge voting interface** — isolated per-judge queue, **+1 / 0** scoring only, **no skip**  
- **Two independent bracket systems per batch** — one for Mini Games, one for Interactive Content  
- **Auto-balanced bracket distribution (round-robin)** with **admin manual override**  
- **Google Sheets sync** via fixed column mapping (cols **A–H**)  
- **Score aggregation** and **admin-confirmed winner selection** (2 per content type = 4 total)

### Out of scope

- Integration with the onemore app or its backend  
- Public user registration or voting  
- Reward distribution (handled by SH Ops / Tracy)  
- Video hosting (judges click the submitted onemore link directly)

---

## 4. User Roles

| Role | Who | Access |
|------|-----|--------|
| **Public Visitor** | Anyone with the link | Page 1 (challenge info) + Page 2 (leaderboard) |
| **Judge** | ~14–16 onemore team members (SH + ID) | Login → assigned queue → vote |
| **Admin** | Ibung (Product Ops) | Full panel: sync, bracket config, judge management, score view, publish |

---

## 5. Challenge Structure Reference

*Sourced from the Academy Program Plan doc. Not a product decision — the system must reflect this structure.*

### Batches

| Batch | Submission period | Evaluation | Announcement |
|-------|-------------------|------------|--------------|
| Batch 1 | 30 Apr – 4 May 2026 | 5 May | 6 May |
| Batch 2 | 7 – 11 May 2026 | 12 May | 13 May |
| Batch 3 | 14 – 18 May 2026 | 19 May | 20 May |

### Winner structure — 4 per batch, 12 total

| Content type | Winners / batch | Award names |
|--------------|-----------------|-------------|
| Mini Games | 2 | Best Game Mechanics, Most Addictive Experience |
| Interactive Content | 2 | Best Interactive Story, Best Interactive Experience |

### Scoring

- **Good = +1**, **Neutral = 0**  
- **Final ranking** = sum of all judge scores for a submission **within its batch and content type**.

---

## 6. Bracket & Judge Distribution Logic

- Each batch has **two fully independent bracket systems**. Mini Games submissions **never** share a bracket with Interactive Content. A judge assigned to a Mini Games bracket sees **only** Mini Games submissions in that bracket.

### Flow

1. Admin **syncs GSheet**. System reads **col H** to route each submission to the correct content type pool.  
2. Admin sets the **number of brackets** for Mini Games and Interactive Content **independently**.  
3. System **auto-distributes** submissions across brackets using **round-robin**: submission 1 → bracket 1, submission 2 → bracket 2, … cycling back to bracket 1 after the last bracket. Guarantees no two brackets differ by more than **one** submission.  
4. Admin can **manually move** individual submissions between brackets of the **same content type** before locking.  
5. Admin assigns **2–3 judges per bracket**. A judge may be assigned to brackets in **both** content types if needed.  
6. After evaluation deadline, Admin **locks the batch**. Judges can no longer submit scores.  
7. Admin views **aggregated scores** per submission (sorted descending, split by content type) and **manually selects 2 winners per type**.  
8. Admin assigns an **award name** to each winner, then **publishes**. Leaderboard updates immediately.

### Edge cases

- **Judge has unscored items at deadline:** Admin sees **per-bracket completion status** and decides whether to proceed.  
- **Only 1 submission** for a content type in a batch: system creates **1 bracket**. Admin picks 1 winner or waits — admin’s call.

### Open question (confirm before dev)

Do top submissions from each bracket advance to a **final round**, or does Admin pick **top 2 from the full aggregated list** across all brackets per content type? **Recommended:** no multi-round — confirm before dev starts.

---

## 7. Data Flow — Google Sheets Sync

Submissions arrive via Google Form and compile to a Google Spreadsheet. The system pulls from this sheet using a **fixed column mapping**. **The form structure must not change** during the program.

### Fixed column mapping

| Col | GForm field | System field | Usage |
|-----|-------------|--------------|--------|
| A | Timestamp | `submitted_at` | Submission time (audit / sorting). |
| B | Email | `creator_email` | Internal reference. **Not shown** to judges or leaderboard. |
| C | Full Name | `creator_name` | Shown to judges and on winner leaderboard. |
| D | Division | `division` | Internal reference only. |
| E | Which batch (fixed choice) | `batch_self_declared` | **Maps to `ProgramBatch`** — options must include **Batch 1**, **Batch 2**, or **Batch 3** (matched to slugs `batch-1` / `batch-2` / `batch-3`). |
| F | Content posting date | `posting_date` | Internal reference only. |
| G | UGC Link | `content_url` | Primary judge-facing content. Must be a valid URL. |
| H | Type of content (Mini Games / Interactive Content) | `content_type` | Routes submission to correct bracket system. |

### Sync behavior

- Admin triggers sync **manually**. **No automatic polling.**  
- Sync pulls all rows. Rows already in the DB (matched by **email + content_url**) are **updated**; new pairs are **created**.  
- **Batch assignment** uses **col E** (self-declared fixed choice), not col A.  
- Col H must match **`Mini Games`** or **`Interactive Content (Real Life + Prompt)`** exactly (**case-insensitive**). Any other value is **flagged** in the admin panel for manual categorization before bracket assignment.  

> **Do not add, remove, or reorder GForm columns** after the program launches. The column mapping is fixed. Changes will silently misread fields.

---

## 8. Feature Specifications

### 8.1 Page 1 — Public challenge information

- **Read-only.** No login. Anyone with the URL can access.

**Content**

- **Hero:** “Prompt Your Creativity & Get the Rewards!”  
- Challenge overview, who can join, how to participate  
- **Batch schedule** with status (Upcoming / Active / Closed)  
- **Content categories:** Mini Games and Interactive Content  
- **Winner structure:** 2 per content type, 4 total per batch  
- **Criteria:** creativity, interactivity, uniqueness  
- **GForm submission link** — prominent CTA, **updatable by Admin without redeployment**  
- **Terms & Conditions** (collapsible)  
- Link to leaderboard (Page 2)

### 8.2 Page 2 — Public leaderboard

- **Per-batch** results, **hidden** until Admin explicitly publishes. Split into **two sections per batch**.

**Layout**

- **Batch tabs:** Batch 1 / Batch 2 / Batch 3  
- Within each batch: **Mini Games** section + **Interactive Content** section  
- Per winner: **creator name**, **award name**, **content type**, **clickable UGC link**  
- **Score totals not shown publicly** — named award only  

#### Batch state machine

| State | Public display |
|-------|----------------|
| Upcoming | “Opens on [date]” |
| Active | “Submissions open” |
| Evaluating | “Winners announced on [date]” |
| Published | Mini Games winners + Interactive Content winners |

### 8.3 Login

- **Single login page** for both Admin and Judge — **role-based routing** after authentication.  
- **Email + password** via NextAuth credentials provider. **No OAuth.**  
- **No session timeout.** Stay logged in until explicit logout.  
- **Single admin account** (Ibung). **Multiple judge accounts**, one per judge.

### 8.4 Admin panel

#### Sync & submissions

- Manually trigger **GSheet sync**  
- View synced submissions **per batch**, filterable by content type and bracket  
- **Flagged list:** submissions with unrecognized `content_type` that need manual categorization  
- **Mark submissions as disqualified** (with reason) — hidden from judges  

#### Bracket management

- Set **number of brackets** per content type per batch **independently**  
- System **auto-distributes (round-robin)**. Admin can **manually move** submissions between brackets of the same type before locking.  
- **Assign judges** to brackets across both content type systems from **one assignment view**  
- **Per-bracket completion status:** X of Y submissions scored (**per judge**)  
- **Lock batch** to close voting. Admin can **unlock** if needed.

#### Results & publishing

- View **aggregated scores** per submission for a **locked** batch, sorted descending, split by content type  
- Admin selects **2 winners** from Mini Games list and **2** from Interactive Content list  
- Admin assigns **award category name** to each winner  
- **Publish** — leaderboard updates immediately. Admin can **un-publish** and **re-publish**.

### 8.5 Judge management (admin)

- Create judge account: **email + temporary password**  
- Assign judge to **one or more brackets**  
- View **per-bracket completion status** across all judges  
- **Reset judge password**

### 8.6 Judge voting interface

- After login, judge sees their assigned queue in **randomized order per session**.

**Submission card**

- Creator name  
- Content type label  
- Clickable UGC link (opens in new tab)  
- Two buttons: **Good (+1)** and **Neutral (0)**  
- **No skip** — judge must score every submission in their queue  

**Queue behavior**

- **Progress indicator:** X of Y reviewed  
- **Queue complete screen** when all submissions are scored  
- Scores are **final** once submitted. Admin can **reset** a specific judge’s score for a submission if a correction is needed.  
- Judge **cannot see other judges’ scores — ever**

---

## 9. Non-functional requirements

| Requirement | Specification |
|-------------|----------------|
| Hosting | Vercel or Railway — publicly accessible via URL |
| Database | PostgreSQL |
| Tech stack | Next.js, Prisma, NextAuth.js (credentials provider) |
| GSheets API | **Google Sheets API v4** — admin-triggered pull only, fixed column mapping A–H |
| Auth | Email + password via NextAuth credentials provider. No OAuth. |
| Score isolation | Judge votes stored per-judge. **Aggregate visible to Admin only**, only after batch is locked. |
| Data retention | All data retained post-program for evaluation (25–27 May 2026) |
| Scale | ~16 judges, ~100 submissions/batch — no load optimization needed |
| Launch deadline | **MVP live by 28 April 2026** |
| Lean principle | Fewer pages, fewer states, fewer moving parts. Reduce bug surface over adding polish. |

---

## 10. Open questions

| # | Question | Options | Owner |
|---|------------|---------|--------|
| 1 | Bracket finalists vs full aggregated list? | A) No multi-round — pick from full list (recommended) B) Bracket-to-final round | Ibung + SH Ops |
| 2 | How many submissions expected per batch? | Estimate from Tracy | Tracy / SH Ops |
| 3 | Names + emails for 14–16 judges? | Confirm before account creation | Tracy + Upi |
| 4 | Leaderboard bilingual (EN + ZH) or English only? | A) EN only B) EN + ZH headers | Ibung + Tracy |
| 5 | Leaderboard URL internal-only or fully public? | A) Internal only B) Fully public | Ibung + Fresa |

---

## 11. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GForm columns change mid-program | Medium | Lock GForm fields. Sync validates column count on import. |
| col H value doesn’t match expected strings | High | Flagged list in admin. Admin manually categorizes before bracket assignment. |
| Judges don’t complete scoring before deadline | Medium | Admin sees per-bracket completion. Admin decides whether to proceed. |
| Dev timeline too tight for 28 April | High | Priority: judge voting + GSheets sync > admin panel > leaderboard. Leaderboard can be static fallback. |
| Admin publishes results early | Low | Explicit confirmation before publish. Un-publish available. |

---

## 12. Recommended build timeline

*Assumes a single developer. Adjust if more hands are available.*

| Date range | Milestone | Deliverables |
|------------|-----------|--------------|
| 1 – 7 April | Setup + Auth | Next.js, DB schema, NextAuth roles |
| 8 – 14 April | Data layer | GSheets sync, fixed col mapping, content_type routing, flag handling |
| 15 – 21 April | Judge interface | Voting queue (per-bracket, isolated), +1/0, progress, complete screen |
| 22 – 25 April | Admin panel | Bracket config, auto-balance, judge assignment, score view, publish controls |
| 26 – 27 April | Public pages + UAT | Page 1, Page 2, end-to-end test |
| **28 April** | **MVP live** | Deploy. Judges receive credentials. |
| 30 April | Batch 1 opens | Admin syncs first submissions and assigns brackets. |

---

## 13. Success metrics

- All judges complete their queue before evaluation deadline — target **100%**.  
- **Zero score leakage** between judges.  
- Admin can sync, assign brackets, and publish results for one batch in **under 30 minutes**.  
- Leaderboard published within **2 hours** of Admin finalizing winners on Announcement Day.  
- **Zero manual GSheet manipulation** required during judging phase.

---

## 14. Implementation status (this repository)

Snapshot vs **PRD v1.3** for the **`onemore-academy-leaderboard`** codebase. Detailed Sheet behavior: **[`GOOGLE-SHEETS.md`](GOOGLE-SHEETS.md)** in this folder.

### Deviations from the original Word PRD (intentional)

| Topic | Original PRD (Word) | This repository |
|-------|---------------------|-----------------|
| Batch assignment | Col A timestamp authoritative for batch | **Col E** (fixed choice “Batch 1/2/3”) mapped to `ProgramBatch` slugs `batch-1` / `batch-2` / `batch-3` — see §7 table + [`GOOGLE-SHEETS.md`](GOOGLE-SHEETS.md) |

### Feature checklist

| Area | PRD requirement | Status in codebase |
|------|-----------------|-------------------|
| Page 1–2, batch states, auth, judges, brackets, lock | As per §8 | **Implemented** |
| GSheet sync | Manual trigger, API v4, A–H | **Implemented** — [`lib/sheets-sync.ts`](../lib/sheets-sync.ts), `/admin/submissions` |
| Deduplication | Email + UGC URL | **Implemented** — `@@unique([creatorEmail, contentUrl])`; sync upserts |
| Batch from col E | Fixed multi-choice → program batch | **Implemented** — [`lib/batch-from-declared.ts`](../lib/batch-from-declared.ts) |
| Flagged col H | Admin list + set type | **Implemented** — `/admin/submissions` |
| Disqualify | Reason; hidden from judges | **Implemented** — `/admin/submissions` |
| Round-robin | Across brackets of same type | **Implemented** — `/admin/batches/[batchId]/results` |
| Aggregated scores | Admin-only, by content type | **Implemented** — same results page |
| Per-judge / bracket completion | X / Y | **Implemented** — results page |
| Judge queue | Isolated, +1/0, no skip | **Implemented** — [`lib/judge-queue.ts`](../lib/judge-queue.ts) |
| Judge queue order | Randomized per session | **Implemented** — shuffle in `getJudgeQueue` |
| Queue complete | Message when all scored | **Implemented** — `/judge` banner |
| Admin reset vote | Per vote row | **Implemented** — results page |
| Publish / unpublish | Hide public winners | **Partial** — changing `publicState` away from `PUBLISHED` hides winners; no separate draft flag |
| Bracket count UI | N brackets per type | **Partial** — manual “Add bracket” per batch |
| Winner picker | From aggregate table | **Partial** — admin uses scores as reference; winners added via Batches UI |
| Sync validation | Column count | **Implemented** — ≥8 columns on header row |

### Remaining polish (optional)

- **Publish confirmation** modal; richer **un-publish** / winner drafts.  
- **Auto-create N brackets** from one control.  
- **NextAuth** session length if “no timeout” must be strict.  
- **Optional:** restore timestamp-only batch assignment via env flag (uses [`find-batch-for-date.ts`](../lib/find-batch-for-date.ts)) — not active today.

---

---

## 15. Supersession by PRD v2.2

The **`onemore-academy-web`** codebase has **migrated** to **PRD v2.2** (`onemore_challenge_prd_v2.2.docx`): participant registration, `OPEN` / `VOTING` / `CONCLUDED` batches, group voting with 1–5 ratings, normalized scores, and **no** Google Sheets integration.

- **Live implementation checklist:** [`docs/PRD-V2.2-IMPLEMENTATION.md`](PRD-V2.2-IMPLEMENTATION.md)
- **Stakeholder direction record:** [`docs/STAKEHOLDER-DECISION-PRD-V2.2.md`](STAKEHOLDER-DECISION-PRD-V2.2.md)
- **§14 above** describes the **retired** v1.3 implementation (judge queue, Sheet sync, brackets). It is **not** updated for v2.2.

---

*End of PRD (v1.3). Section 14 and [`GOOGLE-SHEETS.md`](GOOGLE-SHEETS.md) described the legacy v1.3 product; see §15 for the current stack.*
