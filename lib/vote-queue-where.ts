import type { Prisma } from "@prisma/client";
import { BatchStatus, GroupValidity } from "@prisma/client";

type VoteRole = "participant" | "fallback_voter" | "internal_team";

/**
 * Pending `ContentGroup` rows for the vote queue.
 * - `fallback_voter`: only UNDER_REVIEWED groups in Layer 2 window (INTERNAL_VOTING, not published, optional layer2 cap).
 * - Others: Layer 1 while batch is VOTING, or UNDER_REVIEWED in Layer 2 window.
 */
export function pendingVoteGroupsWhere(userId: string, role: VoteRole): Prisma.ContentGroupWhereInput {
  const now = new Date();
  const layer2BatchFilter: Prisma.ProgramBatchWhereInput = {
    status: BatchStatus.INTERNAL_VOTING,
    winnersPublishedAt: null,
    OR: [{ layer2EndsAt: null }, { layer2EndsAt: { gt: now } }],
  };

  if (role === "fallback_voter") {
    return {
      layer: 1,
      validityStatus: GroupValidity.UNDER_REVIEWED,
      batch: layer2BatchFilter,
      assignments: {
        some: { userId, completed: false },
      },
    };
  }

  return {
    layer: 1,
    assignments: {
      some: { userId, completed: false },
    },
    OR: [
      { batch: { status: BatchStatus.VOTING } },
      {
        validityStatus: GroupValidity.UNDER_REVIEWED,
        batch: layer2BatchFilter,
      },
    ],
  };
}
