/**
 * PRD v2.2 §6.2 — group sizes: min 4 per group, max diff 1 between any two groups,
 * prefer 5 & 6; then 4 & 5; never mix 4 and 6 in the same batch of groups.
 */
export function computeGroupSizes(total: number): number[] {
  if (total <= 0) return [];
  if (total < 4) return [total];

  const fiveSix = tryFiveAndSixOnly(total);
  if (fiveSix) return normalizeOrder(fiveSix);

  const fourFive = tryFourAndFiveOnly(total);
  if (fourFive) return normalizeOrder(fourFive);

  return [total];
}

function normalizeOrder(sizes: number[]): number[] {
  return [...sizes].sort((a, b) => b - a);
}

function tryFiveAndSixOnly(n: number): number[] | null {
  for (let sixes = 0; sixes * 6 <= n; sixes++) {
    const rem = n - sixes * 6;
    if (rem < 0) continue;
    if (rem % 5 !== 0) continue;
    const fives = rem / 5;
    const sizes = [...Array(fives).fill(5), ...Array(sixes).fill(6)] as number[];
    if (sizes.length === 0) continue;
    if (Math.max(...sizes) - Math.min(...sizes) > 1) continue;
    return sizes;
  }
  return null;
}

function tryFourAndFiveOnly(n: number): number[] | null {
  for (let fours = 0; fours * 4 <= n; fours++) {
    const rem = n - fours * 4;
    if (rem < 0) continue;
    if (rem % 5 !== 0) continue;
    const fives = rem / 5;
    const sizes = [...Array(fours).fill(4), ...Array(fives).fill(5)] as number[];
    if (sizes.length === 0) continue;
    if (Math.max(...sizes) - Math.min(...sizes) > 1) continue;
    return sizes;
  }
  return null;
}

/** Split submission indices [0..n-1] into buckets by computed sizes. */
export function bucketIndices(n: number): number[][] {
  const sizes = computeGroupSizes(n);
  const buckets: number[][] = [];
  let start = 0;
  for (const s of sizes) {
    const row: number[] = [];
    for (let i = 0; i < s; i++) {
      row.push(start++);
    }
    buckets.push(row);
  }
  return buckets;
}
