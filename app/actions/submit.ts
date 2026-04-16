"use server";

import { prisma } from "@/lib/prisma";
import { requireParticipantSubmit } from "@/lib/guards";
import { validateContentUrl } from "@/lib/url-check";
import { recomputeCanVote } from "@/lib/eligibility";
import { resolveSubmissionBatch } from "@/lib/submission-batch";
import { BatchStatus, ContentCategory } from "@prisma/client";
import { buildToastUrl } from "@/lib/snackbar-url";
import { redirect } from "next/navigation";

export async function createSubmission(formData: FormData) {
  const session = await requireParticipantSubmit();

  const category = String(formData.get("category") ?? "") as "MINI_GAMES" | "REAL_LIFE_PROMPT";
  const contentUrl = String(formData.get("contentUrl") ?? "").trim();

  if (!contentUrl) redirect(buildToastUrl("/submit", "error", "Add a content URL."));
  if (category !== "MINI_GAMES" && category !== "REAL_LIFE_PROMPT") {
    redirect(buildToastUrl("/submit", "error", "Pick a valid category."));
  }

  const batch = await resolveSubmissionBatch();
  if (!batch) {
    redirect(
      buildToastUrl("/submit", "error", "No batch is accepting submissions in this window."),
    );
  }
  const batchId = batch.id;

  const check = await validateContentUrl(contentUrl);
  if (!check.ok) {
    redirect(buildToastUrl("/submit", "error", check.reason ?? "Invalid or unreachable URL."));
  }

  try {
    await prisma.submission.create({
      data: {
        batchId,
        userId: session.user.id,
        category: category as ContentCategory,
        contentUrl,
      },
    });
    await recomputeCanVote(batchId, session.user.id);
  } catch {
    redirect(buildToastUrl("/submit", "error", "This URL is already submitted for this batch."));
  }
  redirect(buildToastUrl("/submit", "success", "UGC submitted."));
}

export async function deleteSubmission(submissionId: string) {
  const session = await requireParticipantSubmit();

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.userId !== session.user.id) {
    redirect(buildToastUrl("/submit", "error", "Submission not found."));
  }
  const batch = await prisma.programBatch.findUnique({ where: { id: sub.batchId } });
  if (!batch || batch.status !== BatchStatus.OPEN) {
    redirect(buildToastUrl("/submit", "error", "This batch is no longer open for edits."));
  }

  await prisma.submission.delete({ where: { id: submissionId } });
  await recomputeCanVote(sub.batchId, session.user.id);
  redirect(buildToastUrl("/submit", "success", "Submission removed."));
}
