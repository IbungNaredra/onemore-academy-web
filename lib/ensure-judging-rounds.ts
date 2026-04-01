import { ContentType, JudgingRoundKind, JudgingRoundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoundCutsForContentType } from "@/lib/round-cuts";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";

/** Attach legacy brackets to round 1 and create `JudgingRound` rows when enabling multi-round for a type. */
export async function ensureJudgingRoundsForBatch(batchId: string): Promise<void> {
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  if (!batch) return;

  for (const ct of [ContentType.MINI_GAMES, ContentType.INTERACTIVE_CONTENT]) {
    if (!batchUsesMultiRoundForType(batch, ct)) continue;
    const hasAnyRound = await prisma.judgingRound.findFirst({
      where: { batchId, contentType: ct },
    });
    if (hasAnyRound) continue;

    const brackets = await prisma.bracket.findMany({
      where: { batchId, contentType: ct, judgingRoundId: null },
    });
    if (brackets.length === 0) continue;

    const cuts = getRoundCutsForContentType(batch, ct);
    const jr = await prisma.judgingRound.create({
      data: {
        batchId,
        contentType: ct,
        index: 1,
        kind: JudgingRoundKind.MAIN,
        status: JudgingRoundStatus.ACTIVE,
        eliminationTargetK: cuts[0] ?? 4,
      },
    });
    await prisma.bracket.updateMany({
      where: { id: { in: brackets.map((b) => b.id) } },
      data: { judgingRoundId: jr.id },
    });
  }
}
