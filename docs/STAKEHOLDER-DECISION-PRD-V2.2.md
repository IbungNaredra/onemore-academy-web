# Stakeholder decision: PRD v2.2 vs current web scope

**Purpose:** Record a single product direction so engineering and ops can commit to one path. This document is for **Ibung, Tracy, Indonesia/Shanghai Ops**, and the dev lead to complete.

**References**

- **Implemented (Option A):** [PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md).
- Historical v1.3 doc (judge + GSheet): [PRD.md](./PRD.md).
- Pre-build analysis: [PRD-V2.2-GAP-ANALYSIS.md](./PRD-V2.2-GAP-ANALYSIS.md).
- Target spec: `onemore_challenge_prd_v2.2.docx`.

---

## Context

**Engineering has implemented Option A** — participant voting, in-app submissions, group-based 1–5 ratings, and no Google Sheet sync. The previous **staff judge + GSheet** product (v1.3) is **replaced** in this repository; see [PRD.md](./PRD.md) for historical requirements only.

---

## Options

| Option | Description | Keeps current MVP? | Delivers v2.2? |
|--------|-------------|--------------------|----------------|
| **A — Full v2.2** | Replace (or re-platform) the current app to match v2.2: registration, layers, groups, cron, i18n, new leaderboard rules. | No (deprecate judge+Sheet as primary) | Yes |
| **B — Hybrid** | Run two modes (e.g. Sheet import **and** in-app submit) or two deployments. | Partial | Partial — high complexity and duplicate logic |
| **C — Keep judge + Sheet MVP** | Continue [PRD.md](./PRD.md) scope; treat v2.2 as future or separate program. | Yes | No |

**Product recommendation (for discussion only):** Option **A** or **C** is usually clearer than **B**, unless there is a hard migration window where both must run briefly.

---

## Decisions to confirm

1. **Which option (A, B, or C)** is authoritative for the May 2026 program?
2. If **A**: Is **GSheet / Google Form** officially **out of scope** for submissions (per v2.2 §16)?
3. If **A**: Confirm **public leaderboard** shows **normalized score + creator email** (v2.2) vs **no public scores** (v1.3) — this is a **privacy/communications** choice.
4. If **C**: Freeze v2.2 requirements until a later phase; document **launch date** and batch dates from v1.3 only.

---

## Record

| Field | Value |
|-------|--------|
| **Decision** | **A** — Full PRD v2.2 (participant voting platform) |
| **Date** | 2026 (implementation landed in `onemore-academy-web`) |
| **Owner (sign-off)** | *Stakeholders: confirm privacy/comms on public email + scores (PRD v2.2 leaderboard).* |
| **Notes** | Codebase tracks [PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md). GSheet out of scope per v2.2 §16. |

---

## Next steps (ongoing)

- Track shipped vs spec in [PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md) (i18n, Layer 2, ops).
- Product/ops: confirm **public leaderboard** email + score display with PR/comms if needed.
