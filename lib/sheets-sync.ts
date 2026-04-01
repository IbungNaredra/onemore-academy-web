import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findBatchIdFromSelfDeclared } from "@/lib/batch-from-declared";
import {
  assertEightColumns,
  parseContentTypeColH,
  parseSheetCellDate,
} from "@/lib/sheet-parsing";

export type SheetsSyncResult = {
  rowsRead: number;
  created: number;
  updated: number;
  skippedShort: number;
  flagged: number;
  errors: string[];
};

function loadServiceAccountJson(): object {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_FILE?.trim();
  if (filePath) {
    const abs = resolve(process.cwd(), filePath);
    try {
      return JSON.parse(readFileSync(abs, "utf8")) as object;
    } catch (e) {
      throw new Error(
        `Could not read GOOGLE_SERVICE_ACCOUNT_JSON_FILE at ${abs}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawJson) {
    throw new Error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON (single-line JSON) or GOOGLE_SERVICE_ACCOUNT_JSON_FILE (path to .json file). Multi-line JSON in .env does not work — use a file or one minified line.",
    );
  }
  try {
    return JSON.parse(rawJson) as object;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON must be valid single-line JSON. Dotenv cannot store multi-line values: either minify the JSON to one line, or save the key as a file and set GOOGLE_SERVICE_ACCOUNT_JSON_FILE=./google-service-account.json",
    );
  }
}

function getEnvOrThrow(): { spreadsheetId: string; range: string; credentials: object } {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  // Google Forms responses usually land on "Form Responses 1", not Sheet1.
  const range =
    process.env.GOOGLE_SHEETS_RANGE?.trim() ?? "'Form Responses 1'!A:H";
  if (!spreadsheetId) {
    throw new Error("Set GOOGLE_SHEETS_SPREADSHEET_ID in .env.local.");
  }
  const credentials = loadServiceAccountJson();
  return { spreadsheetId, range, credentials };
}

export async function runGoogleSheetsSync(): Promise<SheetsSyncResult> {
  const { spreadsheetId, range, credentials } = getEnvOrThrow();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = res.data.values;
  if (!rows?.length) {
    return {
      rowsRead: 0,
      created: 0,
      updated: 0,
      skippedShort: 0,
      flagged: 0,
      errors: ["No rows returned from sheet."],
    };
  }

  const header = rows[0];
  if (!Array.isArray(header) || header.length < 8) {
    return {
      rowsRead: 0,
      created: 0,
      updated: 0,
      skippedShort: 0,
      flagged: 0,
      errors: [
        `PRD §7: header row must have at least 8 columns (cols A–H). Found ${Array.isArray(header) ? header.length : 0}.`,
      ],
    };
  }

  const batches = await prisma.programBatch.findMany({
    orderBy: { submissionStart: "asc" },
    select: { id: true, slug: true },
  });

  let created = 0;
  let updated = 0;
  let skippedShort = 0;
  let flagged = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i === 0) continue;

    if (!Array.isArray(row) || row.length < 8) {
      skippedShort++;
      if (row && (row as unknown[]).length > 0) {
        errors.push(`Row ${i + 1}: expected 8 columns, got ${(row as unknown[]).length}`);
      }
      continue;
    }

    if (!assertEightColumns(row as unknown[])) continue;

    const [a, b, c, d, e, f, g, h] = row as unknown[];

    const submittedAt = parseSheetCellDate(a);
    if (!submittedAt) {
      errors.push(`Row ${i + 1}: invalid timestamp (col A)`);
      continue;
    }

    const creatorEmail = String(b ?? "")
      .trim()
      .toLowerCase();
    const creatorName = String(c ?? "").trim() || "Unknown";
    const division = String(d ?? "").trim() || null;
    const batchSelfDeclared = String(e ?? "").trim() || null;
    const postingDate = parseSheetCellDate(f);
    const contentUrl = String(g ?? "").trim();
    const ctParsed = parseContentTypeColH(h);

    if (!creatorEmail || !contentUrl) {
      errors.push(`Row ${i + 1}: missing email (B) or UGC link (G)`);
      continue;
    }

    const programBatchId = findBatchIdFromSelfDeclared(batchSelfDeclared, batches);

    let contentType: ContentType;
    let contentTypeRaw: string | null = null;
    let needsTypeReview = false;

    if (ctParsed.ok) {
      contentType = ctParsed.type;
    } else {
      contentType = ContentType.MINI_GAMES;
      contentTypeRaw = ctParsed.raw;
      needsTypeReview = true;
      flagged++;
    }

    const existing = await prisma.submission.findUnique({
      where: {
        creatorEmail_contentUrl: { creatorEmail, contentUrl },
      },
    });

    const data = {
      submittedAt,
      creatorEmail,
      creatorName,
      division,
      batchSelfDeclared,
      postingDate,
      contentUrl,
      contentType,
      contentTypeRaw,
      needsTypeReview,
      programBatchId,
    };

    if (existing) {
      await prisma.submission.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.submission.create({ data });
      created++;
    }
  }

  return {
    rowsRead: Math.max(0, rows.length - 1),
    created,
    updated,
    skippedShort,
    flagged,
    errors: errors.slice(0, 50),
  };
}
