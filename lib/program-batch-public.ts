import { prisma } from "@/lib/prisma";
import {
  type LeaderboardBatchDto,
  type ScheduleBatchDto,
  type WinnerEntryDto,
  type PublicBatchState,
} from "@/lib/leaderboard-types";
import { BatchPublicState, ContentType } from "@prisma/client";

export type { LeaderboardBatchDto, ScheduleBatchDto, WinnerEntryDto, PublicBatchState };
export { batchStateLine } from "@/lib/leaderboard-types";

function prismaStateToUi(s: BatchPublicState): PublicBatchState {
  return s.toLowerCase() as PublicBatchState;
}

function formatSubmissionPeriod(start: Date, end: Date): string {
  const y = start.getUTCFullYear();
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const a = start.toLocaleDateString("en-GB", o);
  const b = end.toLocaleDateString("en-GB", o);
  return `${a} – ${b} ${y}`;
}

function fmtOptional(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const contentLabel: Record<ContentType, string> = {
  [ContentType.MINI_GAMES]: "Mini Games",
  [ContentType.INTERACTIVE_CONTENT]: "Interactive Content",
};

export async function getLeaderboardBatches(): Promise<LeaderboardBatchDto[]> {
  let batches;
  try {
    batches = await prisma.programBatch.findMany({
      orderBy: { submissionStart: "asc" },
      include: {
        winners: { include: { submission: true } },
      },
    });
  } catch (err) {
    console.error("[getLeaderboardBatches] Database error:", err);
    return [];
  }

  return batches.map((b) => {
    const miniGames: WinnerEntryDto[] = [];
    const interactiveContent: WinnerEntryDto[] = [];
    for (const w of b.winners) {
      const entry: WinnerEntryDto = {
        creatorName: w.submission.creatorName,
        awardName: w.awardName,
        contentType: contentLabel[w.contentType],
        contentUrl: w.submission.contentUrl,
      };
      if (w.contentType === ContentType.MINI_GAMES) miniGames.push(entry);
      else interactiveContent.push(entry);
    }
    return {
      id: b.id,
      label: b.label,
      slug: b.slug,
      state: prismaStateToUi(b.publicState),
      submissionPeriod: formatSubmissionPeriod(b.submissionStart, b.submissionEnd),
      evaluationDate: fmtOptional(b.evaluationDate),
      announcementDate: fmtOptional(b.announcementDate),
      miniGames,
      interactiveContent,
    };
  });
}

export async function getScheduleBatches(): Promise<ScheduleBatchDto[]> {
  let batches;
  try {
    batches = await prisma.programBatch.findMany({
      orderBy: { submissionStart: "asc" },
    });
  } catch (err) {
    console.error("[getScheduleBatches] Database error:", err);
    return [];
  }
  return batches.map((b) => ({
    id: b.id,
    label: b.label,
    state: prismaStateToUi(b.publicState),
    submissionPeriod: formatSubmissionPeriod(b.submissionStart, b.submissionEnd),
    evaluationDate: fmtOptional(b.evaluationDate),
    announcementDate: fmtOptional(b.announcementDate),
  }));
}
