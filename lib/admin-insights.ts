import { ContentType, JudgingRoundStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AggregatedRow = {
  submissionId: string;
  creatorName: string;
  contentUrl: string;
  totalScore: number;
  judgeVotes: number;
};

export async function getAggregatedScoresForBatch(batchId: string): Promise<{
  miniGames: AggregatedRow[];
  interactive: AggregatedRow[];
}> {
  const submissions = await prisma.submission.findMany({
    where: { programBatchId: batchId, disqualified: false },
    include: { votes: true },
    orderBy: { creatorName: "asc" },
  });

  const toRow = (s: (typeof submissions)[0]): AggregatedRow => ({
    submissionId: s.id,
    creatorName: s.creatorName,
    contentUrl: s.contentUrl,
    totalScore: s.votes.reduce((a, v) => a + v.score, 0),
    judgeVotes: s.votes.length,
  });

  const sortDesc = (a: AggregatedRow, b: AggregatedRow) =>
    b.totalScore - a.totalScore || a.creatorName.localeCompare(b.creatorName);

  const miniGames: AggregatedRow[] = [];
  const interactive: AggregatedRow[] = [];
  for (const s of submissions) {
    const row = toRow(s);
    if (s.contentType === ContentType.MINI_GAMES) miniGames.push(row);
    else interactive.push(row);
  }
  miniGames.sort(sortDesc);
  interactive.sort(sortDesc);

  return { miniGames, interactive };
}

export type BracketJudgeCompletion = {
  bracketId: string;
  contentType: ContentType;
  sortOrder: number;
  judgeId: string;
  judgeEmail: string;
  judgeName: string | null;
  scored: number;
  total: number;
};

export async function getJudgeBracketCompletion(batchId: string): Promise<BracketJudgeCompletion[]> {
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  const bracketWhere: Prisma.BracketWhereInput = { batchId };
  if (batch) {
    bracketWhere.OR = [
      batch.multiRoundMiniGames
        ? { contentType: ContentType.MINI_GAMES, judgingRound: { status: JudgingRoundStatus.ACTIVE } }
        : { contentType: ContentType.MINI_GAMES },
      batch.multiRoundInteractive
        ? {
            contentType: ContentType.INTERACTIVE_CONTENT,
            judgingRound: { status: JudgingRoundStatus.ACTIVE },
          }
        : { contentType: ContentType.INTERACTIVE_CONTENT },
    ];
  }
  const brackets = await prisma.bracket.findMany({
    where: bracketWhere,
    orderBy: [{ contentType: "asc" }, { sortOrder: "asc" }],
    include: {
      submissions: { where: { disqualified: false }, select: { id: true } },
      assignments: {
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
      },
    },
  });

  const out: BracketJudgeCompletion[] = [];

  for (const br of brackets) {
    const ids = br.submissions.map((s) => s.id);
    const total = ids.length;
    for (const asg of br.assignments) {
      if (asg.user.role !== Role.JUDGE) continue;
      const scored =
        ids.length === 0
          ? 0
          : await prisma.vote.count({
              where: { judgeId: asg.userId, submissionId: { in: ids } },
            });
      out.push({
        bracketId: br.id,
        contentType: br.contentType,
        sortOrder: br.sortOrder,
        judgeId: asg.userId,
        judgeEmail: asg.user.email,
        judgeName: asg.user.name,
        scored,
        total,
      });
    }
  }

  return out;
}

export type VoteRowForAdmin = {
  voteId: string;
  judgeEmail: string;
  submissionId: string;
  creatorName: string;
  score: number;
};

export async function getVotesForBatch(batchId: string): Promise<VoteRowForAdmin[]> {
  const votes = await prisma.vote.findMany({
    where: { submission: { programBatchId: batchId } },
    include: {
      judge: { select: { email: true } },
      submission: { select: { creatorName: true } },
    },
    orderBy: [{ submissionId: "asc" }, { judgeId: "asc" }],
  });
  return votes.map((v) => ({
    voteId: v.id,
    judgeEmail: v.judge.email,
    submissionId: v.submissionId,
    creatorName: v.submission.creatorName,
    score: v.score,
  }));
}
