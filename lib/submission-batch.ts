import { prisma } from "@/lib/prisma";
import { BatchStatus, type ProgramBatch } from "@prisma/client";

/**
 * Whether an OPEN batch accepts new UGC at `now`:
 * - If `now >= votingAt` but the row is still **OPEN**, accept submissions anyway until cron/admin
 *   moves to **VOTING** (covers retest after reset with stale dates, autoTransition off, or transition delay).
 * - While `now < votingAt`, the program’s **lowest** `batchNumber` uses `openAt <= now`.
 * - A **higher** batchNumber may submit before its `openAt` when no lower batch is still OPEN
 *   (e.g. batch 2 after batch 1 concluded). If a lower batch is still OPEN, the higher batch keeps
 *   the strict window `openAt <= now < votingAt`.
 */
function batchAcceptsSubmissionsAt(
  b: ProgramBatch,
  now: Date,
  openCandidates: ProgramBatch[],
  lowestBatchNumber: number,
): boolean {
  if (now >= b.votingAt) {
    return true;
  }
  if (b.batchNumber === lowestBatchNumber) {
    return now >= b.openAt;
  }
  const hasLowerOpen = openCandidates.some((x) => x.batchNumber < b.batchNumber);
  if (hasLowerOpen) {
    return now >= b.openAt && now < b.votingAt;
  }
  return true;
}

/**
 * UGC is tied to the single batch that is accepting submissions **now** among `status === OPEN` rows.
 * If several rows match (misconfiguration), the lowest `batchNumber` wins.
 */
export async function resolveSubmissionBatch(now: Date = new Date()) {
  const [candidates, minRow] = await Promise.all([
    prisma.programBatch.findMany({
      where: { status: BatchStatus.OPEN },
      orderBy: { batchNumber: "asc" },
    }),
    prisma.programBatch.findFirst({
      orderBy: { batchNumber: "asc" },
      select: { batchNumber: true },
    }),
  ]);
  const lowestBatchNumber = minRow?.batchNumber ?? 1;

  const eligible = candidates.filter((b) =>
    batchAcceptsSubmissionsAt(b, now, candidates, lowestBatchNumber),
  );
  const picked = eligible[0] ?? null;

  return picked;
}
