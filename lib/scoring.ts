import { prisma } from "@/lib/prisma";
import { ContentCategory } from "@prisma/client";

/** Average 1–5 rating per submission, then min–max normalize within batch+category to 0–5 scale. */
export async function refreshNormalizedScoresForBatchCategory(batchId: string, category: ContentCategory) {
  const subs = await prisma.submission.findMany({
    where: { batchId, category },
    select: { id: true },
  });
  const avgs: { id: string; avg: number }[] = [];
  for (const s of subs) {
    const ratings = await prisma.rating.findMany({
      where: { submissionId: s.id },
      select: { score: true },
    });
    if (ratings.length === 0) {
      await prisma.submission.update({
        where: { id: s.id },
        data: { normalizedScore: null, totalRatingsReceived: 0 },
      });
      continue;
    }
    const sum = ratings.reduce((a, r) => a + r.score, 0);
    const avg = sum / ratings.length;
    avgs.push({ id: s.id, avg });
  }
  if (avgs.length === 0) return;
  const values = avgs.map((x) => x.avg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (const { id, avg } of avgs) {
    const normalized = max === min ? avg : ((avg - min) / (max - min)) * 5;
    const count = await prisma.rating.count({ where: { submissionId: id } });
    await prisma.submission.update({
      where: { id },
      data: {
        normalizedScore: normalized,
        totalRatingsReceived: count,
      },
    });
  }
}
