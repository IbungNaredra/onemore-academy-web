"use server";

import { prisma } from "@/lib/prisma";
import { requireParticipantSubmit } from "@/lib/guards";
import { validateContentUrl } from "@/lib/url-check";
import { recomputeCanVote } from "@/lib/eligibility";
import { resolveSubmissionBatch } from "@/lib/submission-batch";
import { BatchStatus, ContentCategory } from "@prisma/client";
import { redirect } from "next/navigation";

export async function createSubmission(formData: FormData) {
  const session = await requireParticipantSubmit();

  const category = String(formData.get("category") ?? "") as "MINI_GAMES" | "REAL_LIFE_PROMPT";
  const contentUrl = String(formData.get("contentUrl") ?? "").trim();

  if (!contentUrl) redirect("/submit?error=missing");
  if (category !== "MINI_GAMES" && category !== "REAL_LIFE_PROMPT") redirect("/submit?error=category");

  const batch = await resolveSubmissionBatch();
  if (!batch) {
    redirect("/submit?error=closed");
  }
  const batchId = batch.id;

  const check = await validateContentUrl(contentUrl);
  if (!check.ok) redirect(`/submit?error=${encodeURIComponent(check.reason ?? "url")}`);

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
    redirect("/submit?error=duplicate");
  }
  redirect("/submit?ok=1");
}

export async function deleteSubmission(submissionId: string) {
  const session = await requireParticipantSubmit();

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.userId !== session.user.id) redirect("/submit?error=notfound");
  const batch = await prisma.programBatch.findUnique({ where: { id: sub.batchId } });
  if (!batch || batch.status !== BatchStatus.OPEN) {
    redirect("/submit?error=locked");
  }

  await prisma.submission.delete({ where: { id: submissionId } });
  await recomputeCanVote(sub.batchId, session.user.id);
  redirect("/submit?ok=del");
}
