import { prisma } from "@/lib/prisma";
import { prepareBatchIfEnteringVoting } from "@/lib/voting-assign";
import { BatchStatus, GroupValidity } from "@prisma/client";

const PEER_LAYER1 = "PEER_LAYER1" as const;

/**
 * When peer voting ends, drop incomplete Layer 1 peer assignments so the vote queue
 * and admin UI only see voters who submitted. Admin-added Layer 2 assignments (`LAYER2_ADMIN`)
 * are never pruned here.
 *
 * Must run **after** {@link flagUnderReviewedGroups} with `capturePeerSnapshot: true` so the
 * 50% / UNDER_REVIEWED rule uses the **full** peer roster, not the post-prune remainder.
 */
export async function pruneIncompletePeerLayer1Assignments(batchId: string) {
  await prisma.groupVoterAssignment.deleteMany({
    where: {
      completed: false,
      source: PEER_LAYER1,
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
        await flagUnderReviewedGroups(b.id, { capturePeerSnapshot: true });
        await pruneIncompletePeerLayer1Assignments(b.id);
      }
      try {
        await prepareBatchIfEnteringVoting(b.id, b.status, next);
      } catch (e) {
        console.error("[runBatchTransitions] prepareBatchIfEnteringVoting", b.id, e);
      }
    }
  }
}

export type FlagUnderReviewedOptions = {
  /**
   * When leaving peer voting (`VOTING`): pass `true` so we record peer roster size / completed
   * counts **before** {@link pruneIncompletePeerLayer1Assignments} and compute
   * `completionRate = peerCompleted / peerTotal` (true participation).
   * For {@link adminReevaluateUnderReviewed} omit this — uses stored snapshot when present.
   */
  capturePeerSnapshot?: boolean;
};

/**
 * 50% rule: among **peer** Layer 1 assignments (`source = PEER_LAYER1`), require
 * `completed / total >= 0.5` for VALID; otherwise UNDER_REVIEWED.
 *
 * When `capturePeerSnapshot` is set (end of peer voting, **before** prune), we persist
 * `peerLayer1TotalAtClose` / `peerLayer1CompletedAtClose` for later Recalculate runs.
 */
export async function flagUnderReviewedGroups(batchId: string, options?: FlagUnderReviewedOptions) {
  const capture = options?.capturePeerSnapshot === true;

  const groups = await prisma.contentGroup.findMany({
    where: { batchId, layer: 1 },
    include: {
      assignments: true,
    },
  });
  for (const g of groups) {
    const peer = g.assignments.filter((a) => a.source === PEER_LAYER1);

    let total: number;
    let done: number;

    if (capture) {
      total = peer.length;
      done = peer.filter((a) => a.completed).length;
    } else if (g.peerLayer1TotalAtClose != null) {
      total = g.peerLayer1TotalAtClose;
      done = g.peerLayer1CompletedAtClose ?? 0;
    } else {
      total = peer.length;
      done = peer.filter((a) => a.completed).length;
    }

    const rate = total === 0 ? 0 : done / total;
    await prisma.contentGroup.update({
      where: { id: g.id },
      data: {
        completionRate: rate,
        validityStatus: rate >= 0.5 ? GroupValidity.VALID : GroupValidity.UNDER_REVIEWED,
        ...(capture ? { peerLayer1TotalAtClose: total, peerLayer1CompletedAtClose: done } : {}),
      },
    });
  }
}
