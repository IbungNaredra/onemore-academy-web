/** Primary label for UGC in voting and leaderboards: title when set, else creator display name. */
export function submissionDisplayTitle(contentTitle: string | null | undefined, userName: string): string {
  const t = (contentTitle ?? "").trim();
  return t.length > 0 ? t : userName;
}
