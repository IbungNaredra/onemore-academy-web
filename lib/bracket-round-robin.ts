import { ContentType, JudgingRoundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { batchUsesMultiRoundForType } from "@/lib/multi-round-batch";

/** PRD §6: round-robin across brackets of the same batch + content type. */
export async function applyRoundRobinDistribution(
  batchId: string,
  contentType: ContentType,
): Promise<{ assigned: number; bracketCount: number }> {
  const batch = await prisma.programBatch.findUnique({ where: { id: batchId } });
  const useMr = batch ? batchUsesMultiRoundForType(batch, contentType) : false;
  const bracketWhere = useMr
    ? {
        batchId,
        contentType,
        judgingRound: { status: JudgingRoundStatus.ACTIVE },
      }
    : { batchId, contentType };

  const brackets = await prisma.bracket.findMany({
    where: bracketWhere,
    orderBy: { sortOrder: "asc" },
  });
  if (brackets.length === 0) {
    throw new Error("Create at least one bracket for this content type first.");
  }

  const subWhere = useMr
    ? {
          programBatchId: batchId,
          contentType,
          disqualified: false,
          eliminatedFromJudging: false,
          OR: [
            { bracketId: null },
            { bracket: { judgingRound: { status: JudgingRoundStatus.ACTIVE } } },
          ],
        }
      : {
          programBatchId: batchId,
          contentType,
          disqualified: false,
        };

  const subs = await prisma.submission.findMany({
    where: subWhere,
    orderBy: { createdAt: "asc" },
  });

  for (let i = 0; i < subs.length; i++) {
    const br = brackets[i % brackets.length]!;
    await prisma.submission.update({
      where: { id: subs[i]!.id },
      data: { bracketId: br.id },
    });
  }

  return { assigned: subs.length, bracketCount: brackets.length };
}
