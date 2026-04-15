/**
 * Admin schedule pickers use wall time in Asia/Shanghai (UTC+8, no DST).
 * DB stores UTC instants; cron compares the same wall clock.
 */

const TZ = "Asia/Shanghai";

/** `datetime-local` value `YYYY-MM-DDTHH:mm` interpreted as Shanghai local → UTC `Date`. */
export function parseShanghaiDatetimeLocalToUtc(value: string): Date | null {
  const s = value.trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    throw new Error("Invalid datetime");
  }
  return new Date(`${s}:00+08:00`);
}

/** UTC instant → `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">` in Shanghai. */
export function formatUtcAsShanghaiDatetimeLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const mo = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");
  let h = get("hour");
  let min = get("minute");
  if (/^\d$/.test(h)) h = `0${h}`;
  if (/^\d$/.test(min)) min = `0${min}`;
  return `${y}-${mo}-${day}T${h}:${min}`;
}
