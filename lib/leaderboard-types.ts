export type PublicBatchState = "open" | "voting" | "concluded" | "published";

export type WinnerEntryDto = {
  creatorName: string;
  creatorEmail: string;
  contentType: string;
  contentUrl: string;
  normalizedScore: number | null;
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
  realLifePrompt: WinnerEntryDto[];
};

export type FinalistRow = {
  rank: number;
  name: string;
  email: string;
  score: number | null;
  contentUrl: string;
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
  if (state === "open") return `${label}: Submissions open`;
  if (state === "voting") return `${label}: Voting in progress`;
  if (state === "concluded") return `${label}: Evaluation — winners on ${b.announcementDate ?? "TBD"}`;
  return `${label}: Results published`;
}
