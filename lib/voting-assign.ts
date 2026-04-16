import { prisma } from "@/lib/prisma";
import { bucketIndices } from "@/lib/group-algorithm";
import { BatchStatus, ContentCategory, SubmissionStatus, UserRole } from "@prisma/client";
import { recomputeAllEligibilityForBatch } from "@/lib/eligibility";

/** Build Layer 1 peer groups + voter assignments for one category (OPEN or VOTING). */
export async function assignGroupsAndVoters(batchId: string, category: ContentCategory) {
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!batch || (batch.status !== BatchStatus.OPEN && batch.status !== BatchStatus.VOTING)) {
    throw new Error("Batch must be OPEN or VOTING to form groups.");
  }

  await prisma.rating.deleteMany({
    where: { group: { batchId, category, layer: 1 } },
  });
  await prisma.groupVoterAssignment.deleteMany({
    where: { group: { batchId, category, layer: 1 } },
  });
  await prisma.groupSubmission.deleteMany({
    where: { group: { batchId, category, layer: 1 } },
  });
  await prisma.contentGroup.deleteMany({
    where: { batchId, category, layer: 1 },
  });

  const submissions = await prisma.submission.findMany({
    where: { batchId, category, status: SubmissionStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
  });
  if (submissions.length === 0) {
    return { groups: 0 };
  }

  const buckets = bucketIndices(submissions.length);
  for (let bi = 0; bi < buckets.length; bi++) {
    const idxs = buckets[bi]!;
    const group = await prisma.contentGroup.create({
      data: {
        batchId,
        category,
        layer: 1,
      },
    });
    for (const ii of idxs) {
      const sub = submissions[ii]!;
      await prisma.groupSubmission.create({
        data: {
          groupId: group.id,
          submissionId: sub.id,
        },
      });
    }

    const submitterIds = new Set(idxs.map((i) => submissions[i]!.userId));
    const elig = await prisma.batchVoterEligibility.findMany({
      where: {
        batchId,
        canVote: true,
        user: {
          role: { in: [UserRole.PARTICIPANT, UserRole.FALLBACK_VOTER] },
        },
      },
      select: { userId: true },
    });
    for (const e of elig) {
      if (submitterIds.has(e.userId)) continue;
      await prisma.groupVoterAssignment.create({
        data: {
          groupId: group.id,
          userId: e.userId,
        },
      });
    }
  }

  return { groups: buckets.length };
}

/** Eligibility refresh + groups for both categories. Call while OPEN (before VOTING) or at VOTING start. */
export async function prepareBatchForVoting(batchId: string) {
  await recomputeAllEligibilityForBatch(batchId);
  const categories: ContentCategory[] = [ContentCategory.MINI_GAMES, ContentCategory.REAL_LIFE_PROMPT];
  for (const c of categories) {
    await assignGroupsAndVoters(batchId, c);
  }
  await prisma.programBatch.update({
    where: { id: batchId },
    data: { voterAssignmentDone: true },
  });
}

/**
 * When a batch transitions OPEN → VOTING, build Layer 1 groups once if not already prepared.
 * Skips if `voterAssignmentDone` is already true (groups already built for this batch).
 */
export async function prepareBatchIfEnteringVoting(
  batchId: string,
  previousStatus: BatchStatus,
  newStatus: BatchStatus,
): Promise<void> {
  if (previousStatus !== BatchStatus.OPEN || newStatus !== BatchStatus.VOTING) {
    return;
  }
  const batch = await prisma.programBatch.findUnique({
    where: { id: batchId },
    select: { voterAssignmentDone: true },
  });
  if (!batch || batch.voterAssignmentDone) {
    return;
  }
  await prepareBatchForVoting(batchId);
}
