import { ContentType } from "@prisma/client";

/** PRD §7: col H must match Mini Games or Interactive Content (Real Life + Prompt), case-insensitive. */
export function parseContentTypeColH(raw: unknown): { ok: true; type: ContentType } | { ok: false; raw: string } {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!t) return { ok: false, raw: "" };
  if (t === "mini games") {
    return { ok: true, type: ContentType.MINI_GAMES };
  }
  if (t.includes("interactive content")) {
    return { ok: true, type: ContentType.INTERACTIVE_CONTENT };
  }
  return { ok: false, raw: String(raw ?? "").trim() };
}

/** Google Sheets serial date (days since 1899-12-30) to UTC Date. */
export function sheetsSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 86400000);
}

export function parseSheetCellDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  if (typeof val === "number" && Number.isFinite(val)) {
    if (val > 30000 || val < 20000) {
      // Likely ms timestamp
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return sheetsSerialToDate(val);
  }
  const s = String(val).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

export function assertEightColumns(row: unknown[]): row is [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown] {
  return Array.isArray(row) && row.length >= 8;
}
