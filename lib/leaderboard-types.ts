export type PublicBatchState = "closed" | "open" | "voting" | "internal_voting" | "concluded" | "published";

/** Short label for schedule / pills (not sentence copy). */
export function batchStateDisplayName(s: PublicBatchState): string {
  switch (s) {
    case "closed":
      return "Closed";
    case "open":
      return "Open";
    case "voting":
      return "Voting";
    case "internal_voting":
      return "Voting";
    case "concluded":
      return "Concluded";
    case "published":
      return "Published";
    default:
      return s;
  }
}

export type WinnerEntryDto = {
  /** Participant-chosen title (shown as primary); legacy rows may mirror creator name. */
  contentTitle: string;
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
  contentTitle: string;
  creatorName: string;
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
  if (state === "closed") return `${label}: Closed — competition not open yet`;
  if (state === "open") return `${label}: Submissions open`;
  if (state === "voting") return `${label}: Peer voting in progress`;
  if (state === "internal_voting")
    return `${label}: Internal voting — under review & Layer 2`;
  if (state === "concluded") return `${label}: Concluded — pick winners / publish (${b.announcementDate ?? "TBD"})`;
  return `${label}: Results published`;
}
