/** Public env-only config. Batch schedules and leaderboard data live in PostgreSQL via Prisma. */

export function titleCaseState(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const publicConfig = {
  gformUrl:
    process.env.NEXT_PUBLIC_GFORM_URL ?? "https://forms.gle/replace-with-your-live-form-link",
} as const;
