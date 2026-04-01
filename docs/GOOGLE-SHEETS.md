# Google Sheets sync

Admin-triggered pull from a linked spreadsheet (**Google Sheets API v4**). Entry point: **`/admin/submissions`** → **Pull from Google Sheet**.

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Yes | ID from the spreadsheet URL: `https://docs.google.com/spreadsheets/d/{ID}/edit` |
| `GOOGLE_SERVICE_ACCOUNT_JSON_FILE` | Recommended | Path to the service account JSON file, e.g. `./google-service-account.json` (listed in `.gitignore`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Alternative | Entire key as **one minified line** — multi-line JSON in `.env` will not parse |
| `GOOGLE_SHEETS_RANGE` | Optional | A1 range; default **`'Form Responses 1'!A:H`**. Google Forms usually write to the tab **Form Responses 1**. Names with spaces must use single quotes inside the value, e.g. `GOOGLE_SHEETS_RANGE="'Form Responses 1'!A:H"` |

Enable **Google Sheets API** for the GCP project, create a **service account**, download the JSON key, and **share the spreadsheet** with the service account’s **`client_email`** (Viewer is enough).

---

## Column mapping (A–H)

Aligned with `prisma/schema.prisma` → `Submission` and `lib/sheets-sync.ts`.

| Col | Sheet field | DB / behavior |
|-----|-------------|----------------|
| A | Timestamp | `submittedAt` — parsed from Sheets serial or string |
| B | Email | `creatorEmail` (normalized lowercase) |
| C | Full name | `creatorName` |
| D | Division | `division` (optional) |
| E | Which batch (fixed choice) | `batchSelfDeclared` (raw text) **and** used to set **`programBatchId`** by matching **Batch 1** / **Batch 2** / **Batch 3** → slugs `batch-1`, `batch-2`, `batch-3` (`lib/batch-from-declared.ts`) |
| F | Content posting date | `postingDate` (optional) |
| G | UGC link | `contentUrl` — part of the unique key |
| H | Content type | Maps to Mini Games / Interactive; unknown values → `needsTypeReview` + `contentTypeRaw` |

The **header row** must have **at least 8 columns** or sync returns an error.

---

## Deduplication (unchanged)

**One row in the database per (`creatorEmail`, `contentUrl`).**  
If several sheet rows share the same email and link, each sync **updates** the same submission (last row wins for fields). This matches the PRD unique constraint `@@unique([creatorEmail, contentUrl])`.

---

## Optional utility

Minify a downloaded key file for single-line `GOOGLE_SERVICE_ACCOUNT_JSON`:

```bash
npm run minify:google-key
```

Reads `google-service-account.json` in the project root by default (see `scripts/minify-service-account-json.mjs`).

---

## Code references

| File | Role |
|------|------|
| `lib/sheets-sync.ts` | API call, row loop, upsert |
| `lib/sheet-parsing.ts` | Col H content types, cell dates |
| `lib/batch-from-declared.ts` | Col E → `programBatchId` |
| `lib/find-batch-for-date.ts` | Optional **timestamp-based** batch (not used by sync; reserved if needed) |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No rows | Tab name: use **`Form Responses 1`** (or set `GOOGLE_SHEETS_RANGE` correctly). Wrong tab → empty range. |
| `JSON.parse` / credentials | Use **file path** env or **single-line** JSON; never multi-line in `.env`. |
| API 403 / not found | Spreadsheet shared with service account email; `GOOGLE_SHEETS_SPREADSHEET_ID` correct. |
| Batch shows "—" after sync | Col E must contain text matching **Batch 1**, **Batch 2**, or **Batch 3** (word boundaries). Adjust form labels or extend `lib/batch-from-declared.ts`. |
