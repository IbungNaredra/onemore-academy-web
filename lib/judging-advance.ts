import {
  ContentType,
  JudgingRoundKind,
  JudgingRoundStatus,
} from "@prisma/client";
import type { ProgramBatch } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRoundRobinDistribution } from "@/lib/bracket-round-robin";
import { getRoundCutsForContentType } from "@/lib/round-cuts";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";

export type Scored = { id: string; score: number; creatorName: string };

function sortScored(rows: Scored[]): Scored[] {
  return [...rows].sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.creatorName.localeCompare(b.creatorName) || a.id.localeCompare(b.id),
  );
}

/**
 * Top-K with tie at cutoff: "sure" advance; if too many share the cutoff score, runoff.
 */
export function selectTopKWithRunoff(rows: Scored[], targetK: number): {
  direct: boolean;
  survivorIds?: string[];
  sureIds?: string[];
  runoffPoolIds?: string[];
  runoffPickCount?: number;
} {
  const sorted = sortScored(rows);
  if (sorted.length <= targetK) {
    return { direct: true, survivorIds: sorted.map((r) => r.id) };
  }
  const cutoff = sorted[targetK - 1]!.score;
  const strictlyAbove = sorted.filter((r) => r.score > cutoff);
  const atCutoff = sorted.filter((r) => r.score === cutoff);
  const needFromCutoff = targetK - strictlyAbove.length;
  if (atCutoff.length <= needFromCutoff) {
    const survivorIds = [
      ...strictlyAbove.map((r) => r.id),
      ...atCutoff.slice(0, needFromCutoff).map((r) => r.id),
    ];
    return { direct: true, survivorIds };
  }
  return {
    direct: false,
    sureIds: strictlyAbove.map((r) => r.id),
    runoffPoolIds: atCutoff.map((r) => r.id),
    runoffPickCount: needFromCutoff,
  };
}

async function aggregateScoresForSubmissionIds(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const votes = await prisma.vote.groupBy({
    by: ["submissionId"],
    where: { submissionId: { in: ids } },
    _sum: { score: true },
  });
  const m = new Map<string, number>();
  for (const v of votes) {
    m.set(v.submissionId, v._sum.score ?? 0);
  }
  for (const id of ids) {
    if (!m.has(id)) m.set(id, 0);
  }
  return m;
}

async function nextRoundIndex(batchId: string, ct: ContentType): Promise<number> {
  const agg = await prisma.judgingRound.aggregate({
    where: { batchId, contentType: ct },
    _max: { index: true },
  });
  return (agg._max.index ?? 0) + 1;
}

async function copyJudgeAssignments(batchId: string, ct: ContentType, newBracketIds: string[]) {
  const prev = await prisma.judgingRound.findFirst({
    where: { batchId, contentType: ct, status: JudgingRoundStatus.CLOSED },
    orderBy: { index: "desc" },
    include: { brackets: { orderBy: { sortOrder: "asc" } } },
  });
  if (!prev?.brackets.length) return;
  const prevSorted = prev.brackets;
  const newSorted = [...newBracketIds].sort();
  for (let i = 0; i < Math.min(prevSorted.length, newSorted.length); i++) {
    const fromId = prevSorted[i]!.id;
    const toId = newSorted[i]!;
    const asg = await prisma.judgeBracketAssignment.findMany({ where: { bracketId: fromId } });
    for (const a of asg) {
      await prisma.judgeBracketAssignment.upsert({
        where: { userId_bracketId: { userId: a.userId, bracketId: toId } },
        create: { userId: a.userId, bracketId: toId },
        update: {},
      });
    }
  }
}

/**
 * After batch judging lock: multi-round cuts per content type (cumulative scores).
 * Opens the next active round and clears `judgingLockedAt` when appropriate.
 */
export async function advanceMultiRoundAfterLock(batchId: string): Promise<void> {
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!batch?.multiRoundMiniGames && !batch?.multiRoundInteractive) return;

  for (const ct of [ContentType.MINI_GAMES, ContentType.INTERACTIVE_CONTENT]) {
    if (!batchUsesMultiRoundForType(batch, ct)) continue;
    await advanceContentType(batchId, batch, ct);
  }

  const actives = await prisma.judgingRound.findMany({
    where: { batchId, status: JudgingRoundStatus.ACTIVE },
  });
  const shouldUnlock = actives.length > 0 && actives.some((r) => !r.terminal);

  if (shouldUnlock) {
    await prisma.programBatch.update({
      where: { id: batchId },
      data: { judgingLockedAt: null },
    });
  }
}

async function advanceContentType(
  batchId: string,
  batch: ProgramBatch,
  ct: ContentType,
) {
  const active = await prisma.judgingRound.findFirst({
    where: { batchId, contentType: ct, status: JudgingRoundStatus.ACTIVE },
    include: {
      brackets: { include: { submissions: { where: { disqualified: false } } } },
    },
  });
  if (!active) return;
  if (active.terminal) return;

  const cuts = getRoundCutsForContentType(batch, ct);
  const poolIds = active.brackets.flatMap((b) => b.submissions.map((s) => s.id));
  if (poolIds.length === 0) return;

  const scoreMap = await aggregateScoresForSubmissionIds(poolIds);
  const subs = await prisma.submission.findMany({
    where: { id: { in: poolIds } },
    select: { id: true, creatorName: true },
  });
  const scored: Scored[] = subs.map((s) => ({
    id: s.id,
    creatorName: s.creatorName,
    score: scoreMap.get(s.id) ?? 0,
  }));

  if (active.kind === JudgingRoundKind.RUNOFF) {
    await finishRunoff(batchId, batch, ct, active, scored, cuts);
    return;
  }

  await finishMain(batchId, batch, ct, active, scored, cuts);
}

async function finishMain(
  batchId: string,
  batch: ProgramBatch,
  ct: ContentType,
  active: {
    id: string;
    eliminationTargetK: number | null;
    terminal: boolean;
    brackets: { id: string; submissions: { id: string }[] }[];
  },
  scored: Scored[],
  cuts: number[],
) {
  const targetK = active.eliminationTargetK ?? cuts[0] ?? 4;
  const cutIdx = cuts.indexOf(targetK);
  const isLastPlannedCut = cutIdx >= 0 && cutIdx === cuts.length - 1;

  const pick = selectTopKWithRunoff(scored, targetK);

  const poolIds = active.brackets.flatMap((b) => b.submissions.map((s) => s.id));

  let eliminatedIds: string[] = [];
  if (!pick.direct && pick.runoffPoolIds) {
    const sortedFull = sortScored(scored);
    const co = sortedFull[Math.min(targetK, sortedFull.length) - 1]?.score ?? 0;
    eliminatedIds = sortedFull.filter((r) => r.score < co).map((r) => r.id);
  } else if (pick.direct && pick.survivorIds) {
    const surv = pick.survivorIds;
    eliminatedIds = poolIds.filter((id) => !surv.includes(id));
  }
  if (eliminatedIds.length > 0) {
    await prisma.submission.updateMany({
      where: { id: { in: eliminatedIds } },
      data: { eliminatedFromJudging: true },
    });
  }

  await prisma.judgingRound.update({
    where: { id: active.id },
    data: { status: JudgingRoundStatus.CLOSED },
  });
  await prisma.submission.updateMany({
    where: { id: { in: poolIds } },
    data: { bracketId: null },
  });

  if (!pick.direct && pick.sureIds && pick.runoffPoolIds && pick.runoffPickCount) {
    const idx = await nextRoundIndex(batchId, ct);
    const runoff = await prisma.judgingRound.create({
      data: {
        batchId,
        contentType: ct,
        index: idx,
        kind: JudgingRoundKind.RUNOFF,
        status: JudgingRoundStatus.ACTIVE,
        runoffPickCount: pick.runoffPickCount,
        pendingAdvanceIds: JSON.stringify(pick.sureIds),
        parentRoundId: active.id,
      },
    });
    const br = await prisma.bracket.create({
      data: {
        batchId,
        contentType: ct,
        sortOrder: 0,
        judgingRoundId: runoff.id,
      },
    });
    await prisma.submission.updateMany({
      where: { id: { in: pick.runoffPoolIds } },
      data: { bracketId: br.id, eliminatedFromJudging: false },
    });
    await applyRoundRobinDistribution(batchId, ct);
    await copyJudgeAssignments(batchId, ct, [br.id]);
    return;
  }

  if (!pick.direct || !pick.survivorIds) return;

  const survivors = pick.survivorIds;

  if (isLastPlannedCut) {
    const idx = await nextRoundIndex(batchId, ct);
    const finalMain = await prisma.judgingRound.create({
      data: {
        batchId,
        contentType: ct,
        index: idx,
        kind: JudgingRoundKind.MAIN,
        status: JudgingRoundStatus.ACTIVE,
        terminal: true,
        eliminationTargetK: survivors.length,
      },
    });
    const br = await prisma.bracket.create({
      data: {
        batchId,
        contentType: ct,
        sortOrder: 0,
        judgingRoundId: finalMain.id,
      },
    });
    await prisma.submission.updateMany({
      where: { id: { in: survivors } },
      data: { bracketId: br.id, eliminatedFromJudging: false },
    });
    await applyRoundRobinDistribution(batchId, ct);
    await copyJudgeAssignments(batchId, ct, [br.id]);
    return;
  }

  if (cutIdx < 0) {
    const idx = await nextRoundIndex(batchId, ct);
    const finalMain = await prisma.judgingRound.create({
      data: {
        batchId,
        contentType: ct,
        index: idx,
        kind: JudgingRoundKind.MAIN,
        status: JudgingRoundStatus.ACTIVE,
        terminal: true,
        eliminationTargetK: survivors.length,
      },
    });
    const br = await prisma.bracket.create({
      data: {
        batchId,
        contentType: ct,
        sortOrder: 0,
        judgingRoundId: finalMain.id,
      },
    });
    await prisma.submission.updateMany({
      where: { id: { in: survivors } },
      data: { bracketId: br.id, eliminatedFromJudging: false },
    });
    await applyRoundRobinDistribution(batchId, ct);
    await copyJudgeAssignments(batchId, ct, [br.id]);
    return;
  }

  const nextK = cuts[cutIdx + 1]!;
  const idx = await nextRoundIndex(batchId, ct);
  const nextMain = await prisma.judgingRound.create({
    data: {
      batchId,
      contentType: ct,
      index: idx,
      kind: JudgingRoundKind.MAIN,
      status: JudgingRoundStatus.ACTIVE,
      eliminationTargetK: nextK,
    },
  });
  const br = await prisma.bracket.create({
    data: {
      batchId,
      contentType: ct,
      sortOrder: 0,
      judgingRoundId: nextMain.id,
    },
  });
  await prisma.submission.updateMany({
    where: { id: { in: survivors } },
    data: { bracketId: br.id, eliminatedFromJudging: false },
  });
  await applyRoundRobinDistribution(batchId, ct);
  await copyJudgeAssignments(batchId, ct, [br.id]);
}

async function finishRunoff(
  batchId: string,
  _batch: ProgramBatch,
  ct: ContentType,
  active: {
    id: string;
    parentRoundId: string | null;
    runoffPickCount: number | null;
    pendingAdvanceIds: string | null;
    brackets: { submissions: { id: string }[] }[];
  },
  scored: Scored[],
  cuts: number[],
) {
  const pickN = active.runoffPickCount ?? 1;
  const pending: string[] = active.pendingAdvanceIds ? JSON.parse(active.pendingAdvanceIds) : [];
  const poolIds = active.brackets.flatMap((b) => b.submissions.map((s) => s.id));
  const poolScored = scored.filter((s) => poolIds.includes(s.id));
  const sorted = sortScored(poolScored);
  const picked = sorted.slice(0, pickN).map((r) => r.id);
  const merged = [...new Set([...pending, ...picked])];
  const runoffLosers = poolIds.filter((id) => !picked.includes(id));
  if (runoffLosers.length > 0) {
    await prisma.submission.updateMany({
      where: { id: { in: runoffLosers } },
      data: { eliminatedFromJudging: true },
    });
  }

  await prisma.judgingRound.update({
    where: { id: active.id },
    data: { status: JudgingRoundStatus.CLOSED },
  });
  await prisma.submission.updateMany({
    where: { id: { in: poolIds } },
    data: { bracketId: null },
  });

  const parent = active.parentRoundId
    ? await prisma.judgingRound.findUnique({ where: { id: active.parentRoundId } })
    : null;
  const parentTarget = parent?.eliminationTargetK ?? cuts[0] ?? 4;
  const pi = cuts.indexOf(parentTarget);
  const nextK =
    pi >= 0 && pi + 1 < cuts.length ? cuts[pi + 1]! : cuts[cuts.length - 1] ?? 2;

  const idx = await nextRoundIndex(batchId, ct);
  const nextMain = await prisma.judgingRound.create({
    data: {
      batchId,
      contentType: ct,
      index: idx,
      kind: JudgingRoundKind.MAIN,
      status: JudgingRoundStatus.ACTIVE,
      terminal: false,
      eliminationTargetK: nextK,
    },
  });
  const br = await prisma.bracket.create({
    data: {
      batchId,
      contentType: ct,
      sortOrder: 0,
      judgingRoundId: nextMain.id,
    },
  });
  await prisma.submission.updateMany({
    where: { id: { in: merged } },
    data: { bracketId: br.id, eliminatedFromJudging: false },
  });
  await applyRoundRobinDistribution(batchId, ct);
  await copyJudgeAssignments(batchId, ct, [br.id]);
}
