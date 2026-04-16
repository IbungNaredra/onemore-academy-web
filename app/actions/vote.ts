"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshNormalizedScoresForBatchCategory } from "@/lib/scoring";
import { isLayer2VotingOpen } from "@/lib/layer2-voting";
import { BatchStatus, GroupValidity } from "@prisma/client";

export async function submitGroupRatings(groupId: string, scores: Record<string, number>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in" };
  }
  if (session.user.role === "admin") {
    return { error: "Not allowed" };
  }
  const userId = session.user.id;

  const group = await prisma.contentGroup.findUnique({
    where: { id: groupId },
    include: {
      submissions: { include: { submission: true } },
      assignments: { where: { userId } },
      batch: true,
    },
  });
  if (!group || group.assignments.length === 0) {
    return { error: "Group not found or you are not assigned" };
  }
  if (group.assignments[0]!.completed) {
    return { error: "Already submitted" };
  }

  const isL1Voting = group.layer === 1 && group.batch.status === BatchStatus.VOTING;
  const isL2UnderReviewed =
    group.layer === 1 &&
    group.validityStatus === GroupValidity.UNDER_REVIEWED &&
    group.batch.status === BatchStatus.INTERNAL_VOTING &&
    isLayer2VotingOpen(group.batch);

  if (!isL1Voting && !isL2UnderReviewed) {
    return {
      error:
        "Voting is not open for this group (Layer 1 requires batch VOTING; Layer 2 requires UNDER_REVIEWED and an open Layer 2 window).",
    };
  }

  const subIds = group.submissions.map((s) => s.submissionId);
  for (const sid of subIds) {
    const sc = scores[sid];
    if (typeof sc !== "number" || sc < 1 || sc > 5 || !Number.isInteger(sc)) {
      return { error: "Each submission needs an integer score 1–5" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const sid of subIds) {
        await tx.rating.create({
          data: {
            groupId,
            submissionId: sid,
            voterId: userId,
            score: scores[sid]!,
          },
        });
      }
      await tx.groupVoterAssignment.update({
        where: { groupId_userId: { groupId, userId } },
        data: { completed: true, completedAt: new Date() },
      });
    });
    await refreshNormalizedScoresForBatchCategory(group.batchId, group.category);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Could not save votes (duplicate or server error)" };
  }
}
