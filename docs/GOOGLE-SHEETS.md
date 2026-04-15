# Google Sheets sync (deprecated)

> **This document applied to PRD v1.3 only.** The **current** app (**PRD v2.2**) has **no** Google Sheet or Google Form integration — submissions are created in-app. See **[PRD-V2.2-IMPLEMENTATION.md](./PRD-V2.2-IMPLEMENTATION.md)**.

The following content is **archived** for teams maintaining old deployments or understanding historical column mapping.

---

## Environment (v1.3)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Yes | ID from the spreadsheet URL: `https://docs.google.com/spreadsheets/d/{ID}/edit` |
| `GOOGLE_SERVICE_ACCOUNT_JSON_FILE` | Recommended | Path to the service account JSON file, e.g. `./google-service-account.json` (listed in `.gitignore`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Alternative | Entire key as **one minified line** — multi-line JSON in `.env` will not parse |
| `GOOGLE_SHEETS_RANGE` | Optional | A1 range; default **`'Form Responses 1'!A:H`**. Google Forms usually write to the tab **Form Responses 1**. Names with spaces must use single quotes inside the value, e.g. `GOOGLE_SHEETS_RANGE="'Form Responses 1'!A:H"` |

Enable **Google Sheets API** for the GCP project, create a **service account**, download the JSON key, and **share the spreadsheet** with the service account’s **`client_email`** (Viewer is enough).

---

## Column mapping (A–H) — historical

| Col | Sheet field | Intended DB / behavior (v1.3) |
|-----|-------------|----------------|
| A | Timestamp | `submittedAt` |
| B | Email | `creatorEmail` |
| C | Full name | `creatorName` |
| D | Division | `division` (optional) |
| E | Which batch (fixed choice) | `batchSelfDeclared` + `programBatchId` via batch slugs |
| F | Content posting date | `postingDate` (optional) |
| G | UGC link | `contentUrl` — part of unique key with email |
| H | Content type | Mini Games / Interactive; flagged rows if unknown |

The v1.3 sync lived in removed modules (`lib/sheets-sync.ts`, etc.) and **`/admin/submissions`** pull — those are **not** present in the v2.2 codebase.

---

## Deduplication (historical)

v1.3 used `@@unique([creatorEmail, contentUrl])` on sheet-shaped submissions. v2.2 uses **per-batch** `@@unique([batchId, contentUrl])` with **`userId`** on submissions — see [`prisma/schema.prisma`](../prisma/schema.prisma).
