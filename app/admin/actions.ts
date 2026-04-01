"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BatchPublicState, ContentType, JudgingRoundKind, JudgingRoundStatus, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyRoundRobinDistribution } from "@/lib/bracket-round-robin";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { runGoogleSheetsSync } from "@/lib/sheets-sync";
import { buildToastUrl } from "@/lib/snackbar-url";
import { advanceMultiRoundAfterLock } from "@/lib/judging-advance";
import { ensureJudgingRoundsForBatch } from "@/lib/ensure-judging-rounds";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";
import { revalidateJudgeViews } from "@/lib/revalidate-judge";

function parseContentType(raw: string): ContentType | null {
  if (raw === "MINI_GAMES") return ContentType.MINI_GAMES;
  if (raw === "INTERACTIVE_CONTENT") return ContentType.INTERACTIVE_CONTENT;
  return null;
}

function parseBatchState(raw: string): BatchPublicState | null {
  const u = raw.toUpperCase() as BatchPublicState;
  return Object.values(BatchPublicState).includes(u) ? u : null;
}

export async function createJudge(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  if (!email || !password) throw new Error("Email and password required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: { email, passwordHash, name, role: Role.JUDGE },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("A user with this email already exists");
    }
    throw e;
  }
  revalidatePath("/admin/judges");
}

export async function resetJudgePassword(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId || !password) throw new Error("Missing fields");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const user = await prisma.user.findFirst({ where: { id: userId, role: Role.JUDGE } });
  if (!user) throw new Error("Judge not found");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath("/admin/judges");
}

export async function updateBatchState(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const stateRaw = String(formData.get("publicState") ?? "");
  const state = parseBatchState(stateRaw);
  if (!batchId || !state) throw new Error("Invalid batch or state");
  await prisma.programBatch.update({
    where: { id: batchId },
    data: { publicState: state },
  });
  revalidatePath("/admin/batches");
  revalidatePath("/");
  revalidatePath("/leaderboard");
}

export async function createBracket(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const ct = parseContentType(String(formData.get("contentType") ?? ""));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  if (!batchId || ct === null) throw new Error("Invalid bracket fields");
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");
  let judgingRoundId: string | null = null;
  if (batchUsesMultiRoundForType(batch, ct)) {
    await ensureJudgingRoundsForBatch(batchId);
    const jr = await prisma.judgingRound.findFirst({
      where: {
        batchId,
        contentType: ct,
        status: JudgingRoundStatus.ACTIVE,
        kind: JudgingRoundKind.MAIN,
      },
      orderBy: { index: "desc" },
    });
    judgingRoundId = jr?.id ?? null;
  }
  await prisma.bracket.create({
    data: {
      batchId,
      contentType: ct,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      judgingRoundId,
    },
  });
  revalidatePath("/admin/batches");
}

export async function deleteBracket(formData: FormData) {
  await requireAdmin();
  const bracketId = String(formData.get("bracketId") ?? "");
  if (!bracketId) throw new Error("Missing bracket");
  await prisma.bracket.delete({ where: { id: bracketId } });
  revalidatePath("/admin/batches");
}

export async function createPublishedWinner(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const awardName = String(formData.get("awardName") ?? "").trim();
  const ct = parseContentType(String(formData.get("contentType") ?? ""));
  if (!batchId || !submissionId || !awardName || ct === null) throw new Error("Missing fields");
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error("Submission not found");
  if (submission.contentType !== ct) throw new Error("Submission content type does not match selection");
  const existing = await prisma.publishedWinner.findUnique({ where: { submissionId } });
  if (existing) throw new Error("This submission is already a published winner");
  await prisma.publishedWinner.create({
    data: { batchId, submissionId, awardName, contentType: ct },
  });
  revalidatePath("/admin/batches");
  revalidatePath("/leaderboard");
}

export async function deletePublishedWinner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("winnerId") ?? "");
  if (!id) throw new Error("Missing winner");
  await prisma.publishedWinner.delete({ where: { id } });
  revalidatePath("/admin/batches");
  revalidatePath("/leaderboard");
}

export async function assignJudgeToBracket(formData: FormData) {
  await requireAdmin();
  const bracketId = String(formData.get("bracketId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!bracketId || !userId) throw new Error("Missing bracket or judge");
  const judge = await prisma.user.findFirst({ where: { id: userId, role: Role.JUDGE } });
  if (!judge) throw new Error("Judge not found");
  await prisma.judgeBracketAssignment.upsert({
    where: { userId_bracketId: { userId, bracketId } },
    create: { userId, bracketId },
    update: {},
  });
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
}

export async function removeJudgeAssignment(formData: FormData) {
  await requireAdmin();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) throw new Error("Missing assignment");
  await prisma.judgeBracketAssignment.delete({ where: { id: assignmentId } });
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
}

export async function linkSubmissionToBracket(formData: FormData) {
  await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const bracketId = String(formData.get("bracketId") ?? "").trim();
  if (!submissionId || !bracketId) throw new Error("Missing submission or bracket");
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  const br = await prisma.bracket.findUnique({ where: { id: bracketId } });
  if (!sub || !br) throw new Error("Submission or bracket not found");
  if (sub.programBatchId !== br.batchId) {
    throw new Error("Submission and bracket must belong to the same batch");
  }
  if (sub.contentType !== br.contentType) {
    throw new Error("Content type must match the bracket");
  }
  await prisma.submission.update({ where: { id: submissionId }, data: { bracketId } });
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
}

/**
 * Links every non-disqualified submission in the batch to a bracket matching its content type.
 * One bracket per type → all submissions go to that pool. Multiple brackets per type → round-robin (PRD §6).
 */
export async function autoLinkBatchSubmissions(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("Missing batch");

  const brackets = await prisma.bracket.findMany({
    where: { batchId },
    select: { contentType: true },
  });
  const types = [...new Set(brackets.map((b) => b.contentType))];
  if (types.length === 0) throw new Error("Create at least one bracket for this batch first");

  let linked = 0;
  for (const ct of types) {
    const r = await applyRoundRobinDistribution(batchId, ct);
    linked += r.assigned;
  }

  revalidatePath("/admin/batches");
  revalidateJudgeViews();
  revalidatePath(`/admin/batches/${batchId}/results`);
  const description =
    linked === 0
      ? "Auto-link finished: 0 submissions updated (none eligible for the bracket types in this batch)."
      : `Auto-link finished: ${linked} submission${linked === 1 ? "" : "s"} linked to brackets.`;
  redirect(buildToastUrl("/admin/batches", "success", description));
}

export async function setBatchJudgingLock(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const lockRaw = String(formData.get("lock") ?? "");
  if (!batchId) throw new Error("Missing batch");
  const lock = lockRaw === "1" || lockRaw === "true";
  await prisma.programBatch.update({
    where: { id: batchId },
    data: { judgingLockedAt: lock ? new Date() : null },
  });
  if (lock) {
    const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
    if (batch?.multiRoundMiniGames || batch?.multiRoundInteractive) {
      await advanceMultiRoundAfterLock(batchId);
    }
  }
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
}

export async function updateBatchMultiRoundSettings(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const miniOn = String(formData.get("multiRoundMini") ?? "") === "1";
  const interactiveOn = String(formData.get("multiRoundInteractive") ?? "") === "1";
  const mini = String(formData.get("roundCutsMini") ?? "").trim() || "[4,2]";
  const interactive = String(formData.get("roundCutsInteractive") ?? "").trim() || "[4,2]";
  if (!batchId) throw new Error("Missing batch");
  await prisma.programBatch.update({
    where: { id: batchId },
    data: {
      multiRoundMiniGames: miniOn,
      multiRoundInteractive: interactiveOn,
      roundCutsMini: mini,
      roundCutsInteractive: interactive,
    },
  });
  if (miniOn || interactiveOn) {
    await ensureJudgingRoundsForBatch(batchId);
  }
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
  redirect(
    buildToastUrl(
      "/admin/batches",
      "success",
      "Multi-round settings saved.",
    ),
  );
}

export async function syncGoogleSheet() {
  await requireAdmin();
  let result: Awaited<ReturnType<typeof runGoogleSheetsSync>>;
  try {
    result = await runGoogleSheetsSync();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    redirect(`/admin/submissions?sync=err&msg=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/batches");
  const q = new URLSearchParams({
    sync: "ok",
    ins: String(result.created),
    upd: String(result.updated),
    badh: String(result.flagged),
    short: String(result.skippedShort),
    rows: String(result.rowsRead),
  });
  redirect(`/admin/submissions?${q.toString()}`);
}

export async function setSubmissionDisqualified(formData: FormData) {
  await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "");
  const dqRaw = String(formData.get("disqualified") ?? "");
  const disqualified = dqRaw === "1";
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!submissionId) throw new Error("Missing submission");
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      disqualified,
      disqualifyReason: disqualified ? reason : null,
    },
  });
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
}

export async function fixSubmissionContentType(formData: FormData) {
  await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "");
  const ct = parseContentType(String(formData.get("contentType") ?? ""));
  if (!submissionId || ct === null) throw new Error("Invalid submission or content type");
  await prisma.submission.update({
    where: { id: submissionId },
    data: { contentType: ct, needsTypeReview: false, contentTypeRaw: null },
  });
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/batches");
}

export async function applyRoundRobin(formData: FormData) {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "");
  const ct = parseContentType(String(formData.get("contentType") ?? ""));
  if (!batchId || ct === null) throw new Error("Invalid batch or content type");
  await applyRoundRobinDistribution(batchId, ct);
  revalidatePath("/admin/batches");
  revalidatePath(`/admin/batches/${batchId}/results`);
  revalidateJudgeViews();
  redirect(
    buildToastUrl(
      `/admin/batches/${batchId}/results`,
      "success",
      "Round-robin redistribution applied.",
    ),
  );
}

export async function adminResetVote(formData: FormData) {
  await requireAdmin();
  const voteId = String(formData.get("voteId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");
  if (!voteId) throw new Error("Missing vote");
  await prisma.vote.delete({ where: { id: voteId } });
  revalidatePath("/admin/batches");
  revalidateJudgeViews();
  if (batchId) revalidatePath(`/admin/batches/${batchId}/results`);
}
