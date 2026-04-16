import { prisma } from "@/lib/prisma";
import { BatchStatus } from "@prisma/client";

/**
 * UGC is tied to the single batch that is accepting submissions **now**:
 * `status === OPEN` (not `CLOSED` or later) and `openAt <= now < votingAt` (admin-configured window).
 * If several rows match (misconfiguration), the lowest `batchNumber` wins.
 */
export async function resolveSubmissionBatch(now: Date = new Date()) {
  const candidates = await prisma.programBatch.findMany({
    where: { status: BatchStatus.OPEN },
    orderBy: { batchNumber: "asc" },
  });
  const inWindow = candidates.filter((b) => now >= b.openAt && now < b.votingAt);
  return inWindow[0] ?? null;
}
