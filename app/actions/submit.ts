"use server";

import { prisma } from "@/lib/prisma";
import { requireParticipantSubmit } from "@/lib/guards";
import { validateContentUrl } from "@/lib/url-check";
import { recomputeCanVote } from "@/lib/eligibility";
import { resolveSubmissionBatch } from "@/lib/submission-batch";
import { BatchStatus, ContentCategory, SubmissionStatus } from "@prisma/client";
import { buildToastUrl } from "@/lib/snackbar-url";
import { getPrismaErrorCode, isPrismaClientValidationError } from "@/lib/prisma-error-utils";
import { redirect } from "next/navigation";

const TITLE_MAX = 200;

export async function createSubmission(formData: FormData) {
  const session = await requireParticipantSubmit();

  const category = String(formData.get("category") ?? "") as "MINI_GAMES" | "REAL_LIFE_PROMPT";
  const contentTitle = String(formData.get("contentTitle") ?? "").trim();
  const contentUrl = String(formData.get("contentUrl") ?? "").trim();

  if (!contentTitle) redirect(buildToastUrl("/submit", "error", "Add a content title."));
  if (contentTitle.length > TITLE_MAX) {
    redirect(buildToastUrl("/submit", "error", `Content title must be at most ${TITLE_MAX} characters.`));
  }
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

  const existingWithUrl = await prisma.submission.findFirst({
    where: { batchId, contentUrl },
    select: { id: true, status: true },
  });
  if (existingWithUrl) {
    if (existingWithUrl.status === SubmissionStatus.DISQUALIFIED) {
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "This exact URL is already on file for this batch (including disqualified entries). Use a different link or ask an admin to remove the old submission.",
        ),
      );
    }
    redirect(buildToastUrl("/submit", "error", "This URL is already submitted for this batch."));
  }

  try {
    await prisma.submission.create({
      data: {
        batchId,
        userId: session.user.id,
        category: category as ContentCategory,
        contentTitle,
        contentUrl,
      },
    });
  } catch (e) {
    const code = getPrismaErrorCode(e);
    if (code === "P2002") {
      redirect(buildToastUrl("/submit", "error", "This URL is already submitted for this batch."));
    }
    if (code === "P2003") {
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "Your account no longer matches the database. Please sign out and sign in again, then retry.",
        ),
      );
    }
    if (isPrismaClientValidationError(e)) {
      console.error("createSubmission: Prisma validation error", e);
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "Invalid submission data. Refresh the page and try again, or contact support if this persists.",
        ),
      );
    }
    console.error("createSubmission: prisma.submission.create failed", { code, err: e });
    redirect(
      buildToastUrl(
        "/submit",
        "error",
        "Could not save your submission. Please try again, or contact support if this keeps happening.",
      ),
    );
  }

  try {
    await recomputeCanVote(batchId, session.user.id);
  } catch (e) {
    console.error("createSubmission: recomputeCanVote failed after create", e);
    redirect(
      buildToastUrl(
        "/submit",
        "error",
        "Your submission was saved, but vote eligibility could not be updated. Please contact an admin.",
      ),
    );
  }

  redirect(buildToastUrl("/submit", "success", "UGC submitted."));
}

export async function updateSubmission(submissionId: string, formData: FormData) {
  const session = await requireParticipantSubmit();

  const category = String(formData.get("category") ?? "") as "MINI_GAMES" | "REAL_LIFE_PROMPT";
  const contentTitle = String(formData.get("contentTitle") ?? "").trim();
  const contentUrl = String(formData.get("contentUrl") ?? "").trim();

  if (!contentTitle) redirect(buildToastUrl("/submit", "error", "Add a content title."));
  if (contentTitle.length > TITLE_MAX) {
    redirect(buildToastUrl("/submit", "error", `Content title must be at most ${TITLE_MAX} characters.`));
  }
  if (!contentUrl) redirect(buildToastUrl("/submit", "error", "Add a content URL."));
  if (category !== "MINI_GAMES" && category !== "REAL_LIFE_PROMPT") {
    redirect(buildToastUrl("/submit", "error", "Pick a valid category."));
  }

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub || sub.userId !== session.user.id) {
    redirect(buildToastUrl("/submit", "error", "Submission not found."));
  }
  if (sub.status === SubmissionStatus.DISQUALIFIED) {
    redirect(buildToastUrl("/submit", "error", "Disqualified submissions cannot be edited."));
  }

  const batch = await prisma.programBatch.findUnique({ where: { id: sub.batchId } });
  if (!batch || batch.status !== BatchStatus.OPEN) {
    redirect(buildToastUrl("/submit", "error", "This batch is no longer open for edits."));
  }

  if (category !== sub.category) {
    const inGroup = await prisma.groupSubmission.findFirst({ where: { submissionId } });
    if (inGroup) {
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "Category cannot be changed after this entry is in a voting group. Edit title or link only, or contact an admin.",
        ),
      );
    }
  }

  const check = await validateContentUrl(contentUrl);
  if (!check.ok) {
    redirect(buildToastUrl("/submit", "error", check.reason ?? "Invalid or unreachable URL."));
  }

  const existingWithUrl = await prisma.submission.findFirst({
    where: {
      batchId: sub.batchId,
      contentUrl,
      NOT: { id: submissionId },
    },
    select: { id: true, status: true },
  });
  if (existingWithUrl) {
    if (existingWithUrl.status === SubmissionStatus.DISQUALIFIED) {
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "This exact URL is already on file for this batch (including disqualified entries). Use a different link or ask an admin to remove the old submission.",
        ),
      );
    }
    redirect(buildToastUrl("/submit", "error", "This URL is already submitted for this batch."));
  }

  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        category: category as ContentCategory,
        contentTitle,
        contentUrl,
      },
    });
  } catch (e) {
    const code = getPrismaErrorCode(e);
    if (code === "P2002") {
      redirect(buildToastUrl("/submit", "error", "This URL is already submitted for this batch."));
    }
    if (code === "P2003") {
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "Your account no longer matches the database. Please sign out and sign in again, then retry.",
        ),
      );
    }
    if (isPrismaClientValidationError(e)) {
      console.error("updateSubmission: Prisma validation error", e);
      redirect(
        buildToastUrl(
          "/submit",
          "error",
          "Invalid submission data. Refresh the page and try again, or contact support if this persists.",
        ),
      );
    }
    console.error("updateSubmission: prisma.submission.update failed", { code, err: e });
    redirect(
      buildToastUrl(
        "/submit",
        "error",
        "Could not update your submission. Please try again, or contact support if this keeps happening.",
      ),
    );
  }

  try {
    await recomputeCanVote(sub.batchId, session.user.id);
  } catch (e) {
    console.error("updateSubmission: recomputeCanVote failed after update", e);
    redirect(
      buildToastUrl(
        "/submit",
        "error",
        "Your submission was updated, but vote eligibility could not be refreshed. Please contact an admin.",
      ),
    );
  }

  redirect(buildToastUrl("/submit", "success", "Submission updated."));
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
