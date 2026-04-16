/**
 * Minimum additional *completed* votes needed so peer completions reach **at least half** of the
 * original peer roster size `total` (same threshold as `rate >= 0.5` on the peer snapshot).
 *
 * Example: 20 peers, 1 completed → need 10 total completions → **9** more assignees if each completes once.
 * (Needing 10 more would correspond to a strict-majority bar of 11/20, which this app does not use for VALID.)
 */
export function additionalAssigneesToReachHalfOfPeerRoster(done: number, total: number): number {
  if (total <= 0) return 0;
  const minCompletions = Math.ceil(total / 2);
  return Math.max(0, minCompletions - done);
}

/**
 * Smallest k ≥ 0 such that (done + k) / (total + k) ≥ 0.5 — **if every new assignee stays on the roster
 * and completes** (denominator grows with each add). Often much larger than
 * {@link additionalAssigneesToReachHalfOfPeerRoster} (e.g. 1/20 → **18** here vs **9** there).
 * Shown as secondary context on the admin UNDER_REVIEWED page.
 */
export function additionalAssigneesIfRosterGrows(done: number, total: number): number {
  if (total <= 0) return 0;
  const k = total - 2 * done;
  return Math.max(0, Math.ceil(k));
}
