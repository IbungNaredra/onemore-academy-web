"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { prepareBatchIfEnteringVoting } from "@/lib/voting-assign";
import { refreshNormalizedScoresForBatchCategory } from "@/lib/scoring";
import bcrypt from "bcryptjs";
import {
  BatchStatus,
  ContentCategory,
  UserRole,
  SubmissionStatus,
  GroupValidity,
  GroupVoterAssignmentSource,
} from "@prisma/client";
import { recomputeCanVote } from "@/lib/eligibility";
import { parseShanghaiDatetimeLocalToUtc } from "@/lib/datetime-shanghai";
import { buildToastUrl } from "@/lib/snackbar-url";
import { flagUnderReviewedGroups, pruneIncompletePeerLayer1Assignments } from "@/lib/batch-jobs";
import { isLayer2AdminAssignmentAllowed } from "@/lib/layer2-voting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdminUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function adminSetBatchStatus(batchId: string, status: BatchStatus) {
  await requireAdminUser();
  const prev = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!prev) throw new Error("Batch not found");
  await prisma.programBatch.update({ where: { id: batchId }, data: { status } });
  await prepareBatchIfEnteringVoting(batchId, prev.status, status);
  const shouldFlagUnderReviewed =
    (status === BatchStatus.INTERNAL_VOTING && prev.status !== BatchStatus.INTERNAL_VOTING) ||
    (status === BatchStatus.CONCLUDED && prev.status === BatchStatus.VOTING);
  if (shouldFlagUnderReviewed) {
    if (prev.status === BatchStatus.VOTING) {
      await pruneIncompletePeerLayer1Assignments(batchId);
    }
    await flagUnderReviewedGroups(batchId);
  }
  revalidatePath("/admin/batch");
  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/batch", "success", "Batch status updated."));
}

/** Update batch transition times from admin `datetime-local` fields (Asia/Shanghai). */
export async function adminSetBatchSchedule(batchId: string, formData: FormData) {
  await requireAdminUser();

  let openAt: Date;
  let votingAt: Date;
  let concludedAt: Date;
  let leaderboardPublishAt: Date | null;

  try {
    const o = parseShanghaiDatetimeLocalToUtc(String(formData.get("openAt") ?? ""));
    const v = parseShanghaiDatetimeLocalToUtc(String(formData.get("votingAt") ?? ""));
    const c = parseShanghaiDatetimeLocalToUtc(String(formData.get("concludedAt") ?? ""));
    const pubRaw = String(formData.get("leaderboardPublishAt") ?? "").trim();
    const p = pubRaw ? parseShanghaiDatetimeLocalToUtc(pubRaw) : null;

    if (!o || !v || !c) {
      redirect(buildToastUrl("/admin/batch", "error", "Check all schedule fields (Asia/Shanghai)."));
    }
    openAt = o;
    votingAt = v;
    concludedAt = c;
    leaderboardPublishAt = p;
  } catch {
    redirect(buildToastUrl("/admin/batch", "error", "Invalid schedule format."));
  }

  if (openAt >= votingAt || votingAt >= concludedAt) {
    redirect(
      buildToastUrl(
        "/admin/batch",
        "error",
        "Open must be before voting start, and voting before concluded.",
      ),
    );
  }

  await prisma.programBatch.update({
    where: { id: batchId },
    data: {
      openAt,
      votingAt,
      concludedAt,
      leaderboardPublishAt,
    },
  });
  revalidatePath("/admin/batch");
  revalidatePath("/submit");
  redirect(buildToastUrl("/admin/batch", "success", "Schedule saved."));
}

export async function adminToggleAutoTransition(batchId: string, auto: boolean) {
  await requireAdminUser();
  await prisma.programBatch.update({ where: { id: batchId }, data: { autoTransition: auto } });
  revalidatePath("/admin/batch");
  redirect(
    buildToastUrl("/admin/batch", "success", `Auto transition ${auto ? "on" : "off"}.`),
  );
}

export async function adminDisqualify(submissionId: string, reason: string) {
  await requireAdminUser();
  const sub = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.DISQUALIFIED, disqualifyReason: reason },
  });
  await recomputeCanVote(sub.batchId, sub.userId);
  revalidatePath("/admin/submissions");
  redirect(buildToastUrl("/admin/submissions", "success", "Submission disqualified."));
}

export async function adminSetUserRole(userId: string, role: UserRole) {
  await requireAdminUser();
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!prev) {
    redirect(buildToastUrl("/admin/users", "error", "User not found."));
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });

  if (role === UserRole.FALLBACK_VOTER && prev.role !== UserRole.FALLBACK_VOTER) {
    const batches = await prisma.programBatch.findMany({ select: { id: true } });
    for (const b of batches) {
      await prisma.batchVoterEligibility.upsert({
        where: { batchId_userId: { batchId: b.id, userId } },
        create: { batchId: b.id, userId, canVote: true, adminOverride: true },
        update: { canVote: true, adminOverride: true },
      });
    }
  }

  if (prev.role === UserRole.FALLBACK_VOTER && role !== UserRole.FALLBACK_VOTER) {
    await prisma.batchVoterEligibility.updateMany({
      where: { userId },
      data: { adminOverride: false },
    });
    const batches = await prisma.programBatch.findMany({ select: { id: true } });
    for (const b of batches) {
      await recomputeCanVote(b.id, userId);
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/vote");
  revalidatePath("/submit");
  redirect(buildToastUrl("/admin/users", "success", "Role saved."));
}

export async function adminResetPassword(userId: string, newPassword: string) {
  await requireAdminUser();
  const trimmed = newPassword.trim();
  if (!trimmed) {
    redirect(buildToastUrl("/admin/users", "error", "Password cannot be empty."));
  }
  const hash = await bcrypt.hash(trimmed, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  revalidatePath("/admin/users");
  redirect(buildToastUrl("/admin/users", "success", "Password updated."));
}

export async function adminSetCanVote(batchId: string, userId: string, canVote: boolean, adminOverride: boolean) {
  await requireAdminUser();
  await prisma.batchVoterEligibility.upsert({
    where: { batchId_userId: { batchId, userId } },
    create: { batchId, userId, canVote, adminOverride },
    update: { canVote, adminOverride },
  });
}

export async function adminPublishWinners(batchId: string, submissionIds: string[]) {
  await requireAdminUser();
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");

  if (submissionIds.length === 0) {
    redirect(buildToastUrl("/admin/winners", "error", "Pick at least one submission to publish."));
  }

  await prisma.publishedWinner.deleteMany({ where: { batchId } });

  for (const sid of submissionIds) {
    const sub = await prisma.submission.findFirst({
      where: { id: sid, batchId },
    });
    if (!sub) continue;
    await refreshNormalizedScoresForBatchCategory(batchId, sub.category);
    const fresh = await prisma.submission.findUnique({ where: { id: sid } });
    await prisma.publishedWinner.create({
      data: {
        batchId,
        submissionId: sid,
        publishedScore: fresh?.normalizedScore ?? null,
      },
    });
  }

  await prisma.programBatch.update({
    where: { id: batchId },
    data: { winnersPublishedAt: new Date() },
  });
  revalidatePath("/leaderboard");
  revalidatePath("/admin/winners");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/winners", "success", "Winners published."));
}

export async function adminClearPublish(batchId: string) {
  await requireAdminUser();
  await prisma.publishedWinner.deleteMany({ where: { batchId } });
  await prisma.programBatch.update({
    where: { id: batchId },
    data: { winnersPublishedAt: null },
  });
  revalidatePath("/leaderboard");
  revalidatePath("/admin/winners");
  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/winners", "success", "Winners unpublished for this batch."));
}

/** Re-run 50% / UNDER_REVIEWED flagging for INTERNAL_VOTING or CONCLUDED batches (manual parity with cron). */
export async function adminReevaluateUnderReviewed(batchId: string) {
  await requireAdminUser();
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (
    !batch ||
    (batch.status !== BatchStatus.INTERNAL_VOTING && batch.status !== BatchStatus.CONCLUDED)
  ) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Batch must be INTERNAL_VOTING or CONCLUDED."));
  }
  await flagUnderReviewedGroups(batchId);
  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/under-reviewed", "success", "Completion rates recalculated."));
}

/** Assign internal_team / fallback_voter users as additional Layer 2 voters on an UNDER_REVIEWED group. */
export async function adminAssignLayer2Voters(groupId: string, formData: FormData) {
  await requireAdminUser();
  const group = await prisma.contentGroup.findUnique({
    where: { id: groupId },
    include: { batch: true },
  });
  if (!group || group.layer !== 1) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group not found."));
  }
  if (group.validityStatus !== GroupValidity.UNDER_REVIEWED) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group is not UNDER_REVIEWED."));
  }
  if (!isLayer2AdminAssignmentAllowed(group.batch)) {
    if (group.batch.winnersPublishedAt != null) {
      redirect(
        buildToastUrl(
          "/admin/under-reviewed",
          "error",
          "Winners are already published for this batch; Layer 2 voter assignment is closed.",
        ),
      );
    }
    redirect(
      buildToastUrl(
        "/admin/under-reviewed",
        "error",
        "Batch must be INTERNAL_VOTING (and winners not yet published) to assign Layer 2 voters.",
      ),
    );
  }

  const ids = [...new Set(formData.getAll("assignUserId").map(String))].filter(Boolean);
  if (ids.length === 0) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Pick at least one user."));
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      role: { in: [UserRole.INTERNAL_TEAM, UserRole.FALLBACK_VOTER] },
    },
    select: { id: true },
  });
  if (users.length !== ids.length) {
    redirect(
      buildToastUrl("/admin/under-reviewed", "error", "Only internal team or fallback voters can be assigned."),
    );
  }

  for (const u of users) {
    await prisma.groupVoterAssignment.upsert({
      where: { groupId_userId: { groupId, userId: u.id } },
      create: {
        groupId,
        userId: u.id,
        source: GroupVoterAssignmentSource.LAYER2_ADMIN,
      },
      update: {},
    });
  }

  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/under-reviewed", "success", "Voters assigned."));
}

/** Remove an internal_team or fallback_voter assignment from an UNDER_REVIEWED group (does not remove participants). */
export async function adminUnassignLayer2Voter(groupId: string, formData: FormData) {
  await requireAdminUser();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Missing user."));
  }

  const group = await prisma.contentGroup.findUnique({
    where: { id: groupId },
    include: { batch: true },
  });
  if (!group || group.layer !== 1) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group not found."));
  }
  if (group.validityStatus !== GroupValidity.UNDER_REVIEWED) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group is not UNDER_REVIEWED."));
  }
  if (!isLayer2AdminAssignmentAllowed(group.batch)) {
    if (group.batch.winnersPublishedAt != null) {
      redirect(
        buildToastUrl(
          "/admin/under-reviewed",
          "error",
          "Winners are already published for this batch; Layer 2 voter changes are closed.",
        ),
      );
    }
    redirect(
      buildToastUrl(
        "/admin/under-reviewed",
        "error",
        "Batch must be INTERNAL_VOTING (and winners not yet published) to change Layer 2 voters.",
      ),
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== UserRole.INTERNAL_TEAM && user.role !== UserRole.FALLBACK_VOTER)) {
    redirect(
      buildToastUrl(
        "/admin/under-reviewed",
        "error",
        "Only admin-added internal team or fallback voters can be removed here. Participant assignments are managed by the voting system.",
      ),
    );
  }

  const assignment = await prisma.groupVoterAssignment.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!assignment) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "That user is not assigned to this group."));
  }

  const groupSubmissions = await prisma.groupSubmission.findMany({
    where: { groupId },
    select: { submissionId: true },
  });
  const submissionIds = groupSubmissions.map((s) => s.submissionId);

  await prisma.$transaction(async (tx) => {
    if (submissionIds.length > 0) {
      await tx.rating.deleteMany({
        where: { voterId: userId, submissionId: { in: submissionIds } },
      });
    }
    await tx.groupVoterAssignment.delete({
      where: { groupId_userId: { groupId, userId } },
    });
  });

  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(buildToastUrl("/admin/under-reviewed", "success", "Voter removed from group."));
}

/** Remove every internal_team and fallback_voter assignment on this group (participants unchanged). */
export async function adminUnassignAllLayer2Voters(groupId: string) {
  await requireAdminUser();

  const group = await prisma.contentGroup.findUnique({
    where: { id: groupId },
    include: { batch: true },
  });
  if (!group || group.layer !== 1) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group not found."));
  }
  if (group.validityStatus !== GroupValidity.UNDER_REVIEWED) {
    redirect(buildToastUrl("/admin/under-reviewed", "error", "Group is not UNDER_REVIEWED."));
  }
  if (!isLayer2AdminAssignmentAllowed(group.batch)) {
    if (group.batch.winnersPublishedAt != null) {
      redirect(
        buildToastUrl(
          "/admin/under-reviewed",
          "error",
          "Winners are already published for this batch; Layer 2 voter changes are closed.",
        ),
      );
    }
    redirect(
      buildToastUrl(
        "/admin/under-reviewed",
        "error",
        "Batch must be INTERNAL_VOTING (and winners not yet published) to change Layer 2 voters.",
      ),
    );
  }

  const assignments = await prisma.groupVoterAssignment.findMany({
    where: { groupId },
    include: { user: { select: { role: true } } },
  });
  const targetUserIds = assignments
    .filter((a) => a.user.role === UserRole.INTERNAL_TEAM || a.user.role === UserRole.FALLBACK_VOTER)
    .map((a) => a.userId);

  if (targetUserIds.length === 0) {
    redirect(
      buildToastUrl(
        "/admin/under-reviewed",
        "error",
        "No internal team or fallback voters on this group to remove.",
      ),
    );
  }

  const groupSubmissions = await prisma.groupSubmission.findMany({
    where: { groupId },
    select: { submissionId: true },
  });
  const submissionIds = groupSubmissions.map((s) => s.submissionId);

  await prisma.$transaction(async (tx) => {
    if (submissionIds.length > 0) {
      await tx.rating.deleteMany({
        where: {
          voterId: { in: targetUserIds },
          submissionId: { in: submissionIds },
        },
      });
    }
    await tx.groupVoterAssignment.deleteMany({
      where: { groupId, userId: { in: targetUserIds } },
    });
  });

  revalidatePath("/admin/under-reviewed");
  revalidatePath("/vote");
  redirect(
    buildToastUrl(
      "/admin/under-reviewed",
      "success",
      `Removed ${targetUserIds.length} internal team / fallback voter${targetUserIds.length === 1 ? "" : "s"} from this group.`,
    ),
  );
}
