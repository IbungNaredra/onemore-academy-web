import { prisma } from "@/lib/prisma";
import { prepareBatchIfEnteringVoting } from "@/lib/voting-assign";
import { BatchStatus, GroupValidity, GroupVoterAssignmentSource } from "@prisma/client";

/**
 * When peer voting ends, drop incomplete Layer 1 peer assignments so the 50% rule uses only voters who submitted.
 * Admin-added Layer 2 assignments (`LAYER2_ADMIN`) are never pruned here.
 */
export async function pruneIncompletePeerLayer1Assignments(batchId: string) {
  await prisma.groupVoterAssignment.deleteMany({
    where: {
      completed: false,
      source: GroupVoterAssignmentSource.PEER_LAYER1,
      group: { batchId, layer: 1 },
    },
  });
}

/** Advance batch.status when `autoTransition` and wall-clock UTC instant crosses thresholds. */
export async function runBatchTransitions(now: Date = new Date()) {
  const batches = await prisma.programBatch.findMany({
    where: { autoTransition: true },
  });
  for (const b of batches) {
    let next = b.status;
    if (b.status === BatchStatus.CLOSED && now >= b.openAt) {
      next = BatchStatus.OPEN;
    }
    if (b.status === BatchStatus.OPEN && now >= b.votingAt) {
      next = BatchStatus.VOTING;
    }
    if (b.status === BatchStatus.VOTING && now >= b.concludedAt) {
      next = BatchStatus.INTERNAL_VOTING;
    }
    if (next !== b.status) {
      await prisma.programBatch.update({
        where: { id: b.id },
        data: { status: next },
      });
      if (next === BatchStatus.INTERNAL_VOTING) {
        await pruneIncompletePeerLayer1Assignments(b.id);
        await flagUnderReviewedGroups(b.id);
      }
      try {
        await prepareBatchIfEnteringVoting(b.id, b.status, next);
      } catch (e) {
        console.error("[runBatchTransitions] prepareBatchIfEnteringVoting", b.id, e);
      }
    }
  }
}

/** After peer no-show prune (see `pruneIncompletePeerLayer1Assignments`): mark groups below 50% as UNDER_REVIEWED. */
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
