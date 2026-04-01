"use server";

import { redirect } from "next/navigation";
import { JudgingRoundStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildToastUrl } from "@/lib/snackbar-url";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";
import { parseJudgeReturnPath } from "@/lib/judge-return-path";
import { revalidateJudgeViews } from "@/lib/revalidate-judge";

export async function submitVote(formData: FormData) {
  const session = await auth();
  const returnPath = parseJudgeReturnPath(formData.get("returnTo"));
  if (!session?.user?.email || session.user.role !== "judge") {
    redirect(`/login?callbackUrl=${encodeURIComponent(returnPath)}`);
  }

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const scoreRaw = String(formData.get("score") ?? "");
  const score = scoreRaw === "1" ? 1 : scoreRaw === "0" ? 0 : null;
  if (!submissionId || score === null) {
    redirect(`${returnPath}?error=invalid`);
  }

  const judge = await prisma.user.findUnique({
    where: { email: session.user.email.trim().toLowerCase() },
  });
  if (!judge || judge.role !== Role.JUDGE) {
    redirect(`/login?callbackUrl=${encodeURIComponent(returnPath)}`);
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { bracket: { include: { batch: true, judgingRound: true } } },
  });

  if (!submission?.bracketId || !submission.bracket) {
    redirect(`${returnPath}?error=bracket`);
  }

  const b = submission.bracket.batch;
  if (
    batchUsesMultiRoundForType(b, submission.contentType) &&
    (!submission.bracket.judgingRound ||
      submission.bracket.judgingRound.status !== JudgingRoundStatus.ACTIVE)
  ) {
    redirect(`${returnPath}?error=bracket`);
  }

  if (b.judgingLockedAt) {
    redirect(`${returnPath}?error=locked`);
  }

  const assigned = await prisma.judgeBracketAssignment.findFirst({
    where: { userId: judge.id, bracketId: submission.bracketId },
  });
  if (!assigned) {
    redirect(`${returnPath}?error=forbidden`);
  }

  await prisma.vote.upsert({
    where: {
      judgeId_submissionId: { judgeId: judge.id, submissionId },
    },
    create: { judgeId: judge.id, submissionId, score },
    update: { score },
  });

  revalidateJudgeViews();
  redirect(buildToastUrl(returnPath, "success", "Vote saved."));
}
