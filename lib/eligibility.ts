import { prisma } from "@/lib/prisma";
import { SubmissionStatus, UserRole } from "@prisma/client";

/** Recompute canVote when submissions change (respects adminOverride rows). */
export async function recomputeCanVote(batchId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const existing = await prisma.batchVoterEligibility.findUnique({
    where: { batchId_userId: { batchId, userId } },
  });

  if (existing?.adminOverride) {
    return;
  }

  let canVote = false;
  if (user.role === UserRole.INTERNAL_TEAM) {
    canVote = true;
  } else if (user.role === UserRole.FALLBACK_VOTER) {
    /** Default true so fallback voters can be assigned to groups / Layer 2 without manual `BatchVoterEligibility` rows. */
    canVote = existing?.canVote ?? true;
  } else {
    const activeSubs = await prisma.submission.count({
      where: { batchId, userId, status: SubmissionStatus.ACTIVE },
    });
    canVote = activeSubs >= 1;
  }

  await prisma.batchVoterEligibility.upsert({
    where: { batchId_userId: { batchId, userId } },
    create: {
      batchId,
      userId,
      canVote,
      adminOverride: false,
    },
    update: {
      canVote,
    },
  });
}

export async function recomputeAllEligibilityForBatch(batchId: string) {
  const users = await prisma.user.findMany({
    select: { id: true },
  });
  for (const u of users) {
    await recomputeCanVote(batchId, u.id);
  }
}
