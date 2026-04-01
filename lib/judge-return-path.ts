/** Paths judges may return to after voting (prevents open redirects). */
export const JUDGE_VOTE_RETURN_PATHS = [
  "/judge",
  "/judge/mini-games",
  "/judge/interactive",
] as const;

export type JudgeVoteReturnPath = (typeof JUDGE_VOTE_RETURN_PATHS)[number];

export function parseJudgeReturnPath(raw: unknown): JudgeVoteReturnPath {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (JUDGE_VOTE_RETURN_PATHS as readonly string[]).includes(s)
    ? (s as JudgeVoteReturnPath)
    : "/judge";
}
