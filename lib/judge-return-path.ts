/** Legacy name kept for snackbar redirect allowlist — PRD v2.2 vote hub. */
export const JUDGE_VOTE_RETURN_PATHS = ["/vote", "/vote/", "/submit", "/"] as const;

export function defaultJudgeReturnPath(): string {
  return "/vote";
}
