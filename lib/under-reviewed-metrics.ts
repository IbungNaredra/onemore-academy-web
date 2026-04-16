/**
 * Smallest k ≥ 0 such that (done + k) / (total + k) ≥ 0.5, assuming new voters complete.
 * `done` / `total` are counts **after** Layer 1 peer no-shows are pruned (see `pruneIncompletePeerLayer1Assignments`).
 */
export function additionalVotersToReachHalf(done: number, total: number): number {
  if (total <= 0) return 0;
  const k = total - 2 * done;
  return Math.max(0, Math.ceil(k));
}
