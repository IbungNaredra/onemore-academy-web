import { prisma } from "@/lib/prisma";
import { BatchStatus, GroupValidity } from "@prisma/client";

/** Advance batch.status when `autoTransition` and wall-clock UTC instant crosses thresholds. */
export async function runBatchTransitions(now: Date = new Date()) {
  const batches = await prisma.programBatch.findMany({
    where: { autoTransition: true },
  });
  for (const b of batches) {
    let next = b.status;
    if (b.status === BatchStatus.OPEN && now >= b.votingAt) {
      next = BatchStatus.VOTING;
    }
    if (b.status === BatchStatus.VOTING && now >= b.concludedAt) {
      next = BatchStatus.CONCLUDED;
    }
    if (next !== b.status) {
      await prisma.programBatch.update({
        where: { id: b.id },
        data: { status: next },
      });
      if (next === BatchStatus.CONCLUDED) {
        await flagUnderReviewedGroups(b.id);
      }
    }
  }
}

/** Wednesday 00:00 — mark groups below completion threshold as UNDER_REVIEWED. */
export async function flagUnderReviewedGroups(batchId: string) {
  const groups = await prisma.contentGroup.findMany({
    where: { batchId, layer: 1 },
    include: {
      assignments: true,
    },
  });
  for (const g of groups) {
    const done = g.assignments.filter((a) => a.completed).length;
    const total = g.assignments.length;
    const rate = total === 0 ? 0 : done / total;
    await prisma.contentGroup.update({
      where: { id: g.id },
      data: {
        completionRate: rate,
        validityStatus: rate >= 0.5 ? GroupValidity.VALID : GroupValidity.UNDER_REVIEWED,
      },
    });
  }
}
