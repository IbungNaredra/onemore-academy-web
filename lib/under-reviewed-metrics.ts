/** Smallest k ≥ 0 such that (done + k) / (total + k) ≥ 0.5, assuming new voters complete. */
export function additionalVotersToReachHalf(done: number, total: number): number {
  if (total <= 0) return 0;
  const k = total - 2 * done;
  return Math.max(0, Math.ceil(k));
}
