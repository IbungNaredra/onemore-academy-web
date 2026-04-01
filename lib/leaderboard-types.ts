export type PublicBatchState = "upcoming" | "active" | "evaluating" | "published";

export type WinnerEntryDto = {
  creatorName: string;
  awardName: string;
  contentType: string;
  contentUrl: string;
};

export type LeaderboardBatchDto = {
  id: string;
  label: string;
  slug: string;
  state: PublicBatchState;
  submissionPeriod: string;
  evaluationDate: string | null;
  announcementDate: string | null;
  miniGames: WinnerEntryDto[];
  interactiveContent: WinnerEntryDto[];
};

export type ScheduleBatchDto = {
  id: string;
  label: string;
  state: PublicBatchState;
  submissionPeriod: string;
  evaluationDate: string | null;
  announcementDate: string | null;
};

export function batchStateLine(b: LeaderboardBatchDto | ScheduleBatchDto): string {
  const label = b.label;
  const state = b.state;
  if (state === "upcoming") return `${label}: Opens on ${b.submissionPeriod}`;
  if (state === "active") return `${label}: Submissions open`;
  if (state === "evaluating")
    return `${label}: Winners announced on ${b.announcementDate ?? "TBD"}`;
  return `${label}: Winners published`;
}
