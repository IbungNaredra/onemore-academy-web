"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { prepareBatchForVoting } from "@/lib/voting-assign";
import { refreshNormalizedScoresForBatchCategory } from "@/lib/scoring";
import bcrypt from "bcryptjs";
import { BatchStatus, ContentCategory, UserRole, SubmissionStatus } from "@prisma/client";
import { recomputeCanVote } from "@/lib/eligibility";
import { parseShanghaiDatetimeLocalToUtc } from "@/lib/datetime-shanghai";
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
  await prisma.programBatch.update({ where: { id: batchId }, data: { status } });
  revalidatePath("/admin/batch");
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
      redirect("/admin/batch?error=schedule");
    }
    openAt = o;
    votingAt = v;
    concludedAt = c;
    leaderboardPublishAt = p;
  } catch {
    redirect("/admin/batch?error=schedule");
  }

  if (openAt >= votingAt || votingAt >= concludedAt) {
    redirect("/admin/batch?error=order");
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
  redirect("/admin/batch?ok=schedule");
}

export async function adminToggleAutoTransition(batchId: string, auto: boolean) {
  await requireAdminUser();
  await prisma.programBatch.update({ where: { id: batchId }, data: { autoTransition: auto } });
  revalidatePath("/admin/batch");
}

export async function adminRunPrepareVoting(batchId: string) {
  await requireAdminUser();
  await prepareBatchForVoting(batchId);
  revalidatePath("/admin/batch");
}

export async function adminDisqualify(submissionId: string, reason: string) {
  await requireAdminUser();
  const sub = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: SubmissionStatus.DISQUALIFIED, disqualifyReason: reason },
  });
  await recomputeCanVote(sub.batchId, sub.userId);
}

export async function adminSetUserRole(userId: string, role: UserRole) {
  await requireAdminUser();
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function adminResetPassword(userId: string, newPassword: string) {
  await requireAdminUser();
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
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
}

export async function adminClearPublish(batchId: string) {
  await requireAdminUser();
  await prisma.publishedWinner.deleteMany({ where: { batchId } });
  await prisma.programBatch.update({
    where: { id: batchId },
    data: { winnersPublishedAt: null },
  });
}
