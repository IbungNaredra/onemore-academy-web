/** Query keys read by {@link SnackbarFromSearchParams} (see `components/snackbar-from-search-params.tsx`). */

export function buildToastUrl(path: string, variant: "success" | "error", description?: string): string {
  const [p, q = ""] = path.includes("?") ? path.split("?", 2) : [path, ""];
  const params = new URLSearchParams(q);
  params.set("toast", variant);
  if (description) params.set("toastDescription", description);
  const s = params.toString();
  return s ? `${p}?${s}` : p;
}

export const JUDGE_ERROR_MESSAGES: Record<string, string> = {
  locked: "Judging is locked for this batch; scores cannot be changed.",
  forbidden: "You are not assigned to judge this submission.",
  bracket: "This submission is not linked to a bracket yet.",
  invalid: "Something went wrong sending your vote. Try again.",
};
