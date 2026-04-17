import type { Prisma } from "@prisma/client";
import { BatchStatus, GroupValidity } from "@prisma/client";

type VoteRole = "participant" | "fallback_voter" | "internal_team";

function assignmentFilter(
  userId: string,
  pendingOnly: boolean,
): Prisma.GroupVoterAssignmentListRelationFilter {
  if (pendingOnly) {
    return { some: { userId, completed: false } };
  }
  return { some: { userId } };
}

/**
 * Layer-1 groups in the vote queue for this user.
 * @param pendingOnly — `true`: only groups with an incomplete assignment (queue).
 *   `false`: any group where the user has an assignment (for progress total).
 */
export function voteGroupsWhere(
  userId: string,
  role: VoteRole,
  pendingOnly: boolean,
): Prisma.ContentGroupWhereInput {
  const now = new Date();
  const layer2BatchFilter: Prisma.ProgramBatchWhereInput = {
    status: BatchStatus.INTERNAL_VOTING,
    winnersPublishedAt: null,
    OR: [{ layer2EndsAt: null }, { layer2EndsAt: { gt: now } }],
  };

  const assignments = assignmentFilter(userId, pendingOnly);

  if (role === "fallback_voter") {
    return {
      layer: 1,
      validityStatus: GroupValidity.UNDER_REVIEWED,
      batch: layer2BatchFilter,
      assignments,
    };
  }

  return {
    layer: 1,
    assignments,
    OR: [
      { batch: { status: BatchStatus.VOTING } },
      {
        validityStatus: GroupValidity.UNDER_REVIEWED,
        batch: layer2BatchFilter,
      },
    ],
  };
}

/** Pending `ContentGroup` rows for the vote queue (incomplete assignment only). */
export function pendingVoteGroupsWhere(userId: string, role: VoteRole): Prisma.ContentGroupWhereInput {
  return voteGroupsWhere(userId, role, true);
}

/** All in-scope groups where this user has a voting assignment (completed or not) — for progress `total`. */
export function assignedVoteGroupsWhere(userId: string, role: VoteRole): Prisma.ContentGroupWhereInput {
  return voteGroupsWhere(userId, role, false);
}
