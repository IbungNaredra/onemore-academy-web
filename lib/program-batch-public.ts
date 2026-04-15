import { prisma } from "@/lib/prisma";
import {
  type LeaderboardBatchDto,
  type ScheduleBatchDto,
  type WinnerEntryDto,
  type PublicBatchState,
} from "@/lib/leaderboard-types";
import { BatchStatus, ContentCategory, SubmissionStatus } from "@prisma/client";
import type { FinalistRow } from "@/lib/leaderboard-types";

export type { LeaderboardBatchDto, ScheduleBatchDto, WinnerEntryDto, PublicBatchState };
export { batchStateLine } from "@/lib/leaderboard-types";

function uiState(batch: {
  status: BatchStatus;
  winnersPublishedAt: Date | null;
}): PublicBatchState {
  if (batch.winnersPublishedAt) return "published";
  return batch.status.toLowerCase() as PublicBatchState;
}

const categoryLabel: Record<ContentCategory, string> = {
  [ContentCategory.MINI_GAMES]: "Mini Games",
  [ContentCategory.REAL_LIFE_PROMPT]: "Real Life + Prompt",
};

function formatPeriod(start: Date, end: Date): string {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return `${start.toLocaleDateString("en-GB", o)} – ${end.toLocaleDateString("en-GB", o)}`;
}

function fmt(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
    timeZoneName: "short",
  });
}

export async function getLeaderboardBatches(): Promise<LeaderboardBatchDto[]> {
  try {
    const batches = await prisma.programBatch.findMany({
      orderBy: { batchNumber: "asc" },
      include: {
        winners: {
          include: {
            submission: { include: { user: true } },
          },
        },
      },
    });

    return batches.map((b) => {
      const miniGames: WinnerEntryDto[] = [];
      const realLifePrompt: WinnerEntryDto[] = [];
      for (const w of b.winners) {
        const s = w.submission;
        const entry: WinnerEntryDto = {
          creatorName: s.user.name,
          creatorEmail: s.user.email,
          contentType: categoryLabel[s.category],
          contentUrl: s.contentUrl,
          normalizedScore: w.publishedScore ?? s.normalizedScore,
        };
        if (s.category === ContentCategory.MINI_GAMES) miniGames.push(entry);
        else realLifePrompt.push(entry);
      }
      return {
        id: b.id,
        label: b.label,
        slug: b.slug,
        state: uiState(b),
        submissionPeriod: formatPeriod(b.openAt, b.votingAt),
        evaluationDate: fmt(b.concludedAt),
        announcementDate: fmt(b.leaderboardPublishAt),
        miniGames,
        realLifePrompt,
      };
    });
  } catch (err) {
    console.error("[getLeaderboardBatches]", err);
    return [];
  }
}

export async function getScheduleBatches(): Promise<ScheduleBatchDto[]> {
  try {
    const batches = await prisma.programBatch.findMany({
      orderBy: { batchNumber: "asc" },
    });
    return batches.map((b) => ({
      id: b.id,
      label: b.label,
      state: uiState(b),
      submissionPeriod: formatPeriod(b.openAt, b.votingAt),
      evaluationDate: fmt(b.concludedAt),
      announcementDate: fmt(b.leaderboardPublishAt),
    }));
  } catch (err) {
    console.error("[getScheduleBatches]", err);
    return [];
  }
}

async function mapTop(batchId: string, category: ContentCategory): Promise<FinalistRow[]> {
  const rows = await prisma.submission.findMany({
    where: { batchId, category, status: SubmissionStatus.ACTIVE },
    orderBy: [{ normalizedScore: "desc" }, { id: "asc" }],
    take: 10,
    include: { user: true },
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.user.name,
    email: r.user.email,
    score: r.normalizedScore,
    contentUrl: r.contentUrl,
  }));
}

export async function getFinalistsByBatch(): Promise<Record<string, { mini: FinalistRow[]; rl: FinalistRow[] }>> {
  const batches = await prisma.programBatch.findMany({ select: { id: true } });
  const out: Record<string, { mini: FinalistRow[]; rl: FinalistRow[] }> = {};
  for (const b of batches) {
    out[b.id] = {
      mini: await mapTop(b.id, ContentCategory.MINI_GAMES),
      rl: await mapTop(b.id, ContentCategory.REAL_LIFE_PROMPT),
    };
  }
  return out;
}
