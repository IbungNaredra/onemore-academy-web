import { ContentType, JudgingRoundStatus, Role } from "@prisma/client";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";
import { prisma } from "@/lib/prisma";

/** PRD §8.6: randomized order per session (shuffle on each load). */
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export type JudgeQueueRow = {
  submissionId: string;
  creatorName: string;
  contentUrl: string;
  contentType: ContentType;
  batchLabel: string;
  locked: boolean;
  currentScore: number | null;
};

export type JudgeQueueResult =
  | { ok: true; email: string; rows: JudgeQueueRow[]; voted: number; total: number }
  | { ok: false; reason: "no_db_user" | "not_judge" };

export async function getJudgeQueue(
  email: string,
  contentType?: ContentType,
): Promise<JudgeQueueResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, role: true, email: true },
  });
  if (!user) return { ok: false, reason: "no_db_user" };
  if (user.role !== Role.JUDGE) return { ok: false, reason: "not_judge" };

  const assignments = await prisma.judgeBracketAssignment.findMany({
    where: { userId: user.id },
    include: {
      bracket: {
        include: {
          batch: true,
          judgingRound: true,
          submissions: {
            where: { disqualified: false, eliminatedFromJudging: false },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const meta = new Map<
    string,
    { batchLabel: string; locked: boolean; submission: (typeof assignments)[0]["bracket"]["submissions"][0] }
  >();

  for (const a of assignments) {
    if (contentType !== undefined && a.bracket.contentType !== contentType) {
      continue;
    }
    const b = a.bracket.batch;
    if (
      batchUsesMultiRoundForType(b, a.bracket.contentType) &&
      (!a.bracket.judgingRound || a.bracket.judgingRound.status !== JudgingRoundStatus.ACTIVE)
    ) {
      continue;
    }
    const locked = b.judgingLockedAt != null;
    const label = b.label;
    for (const s of a.bracket.submissions) {
      if (!meta.has(s.id)) {
        meta.set(s.id, { batchLabel: label, locked, submission: s });
      }
    }
  }

  const submissionIds = [...meta.keys()];
  const votes =
    submissionIds.length === 0
      ? []
      : await prisma.vote.findMany({
          where: { judgeId: user.id, submissionId: { in: submissionIds } },
        });
  const scoreBySub = new Map(votes.map((v) => [v.submissionId, v.score]));

  const sortedEntries = [...meta.entries()].sort(
    (a, b) => a[1].submission.createdAt.getTime() - b[1].submission.createdAt.getTime(),
  );

  const rowsOrdered: JudgeQueueRow[] = sortedEntries.map(([submissionId, m]) => ({
    submissionId,
    creatorName: m.submission.creatorName,
    contentUrl: m.submission.contentUrl,
    contentType: m.submission.contentType,
    batchLabel: m.batchLabel,
    locked: m.locked,
    currentScore: scoreBySub.get(submissionId) ?? null,
  }));

  const rows = shuffle(rowsOrdered);

  const voted = rows.filter((r) => r.currentScore !== null).length;

  return {
    ok: true,
    email: user.email,
    rows,
    voted,
    total: rows.length,
  };
}
