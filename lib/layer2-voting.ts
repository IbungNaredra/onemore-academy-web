import { BatchStatus } from "@prisma/client";

/** Layer 2 = voting on UNDER_REVIEWED groups while batch is INTERNAL_VOTING, before winners are published and before optional layer2EndsAt. */
export function isLayer2VotingOpen(
  batch: {
    status: BatchStatus;
    winnersPublishedAt: Date | null;
    layer2EndsAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (batch.status !== BatchStatus.INTERNAL_VOTING) return false;
  if (batch.winnersPublishedAt != null) return false;
  if (batch.layer2EndsAt != null && now >= batch.layer2EndsAt) return false;
  return true;
}

/**
 * Admin may add Layer 2 voters while the batch is INTERNAL_VOTING and winners are not yet published.
 * Unlike {@link isLayer2VotingOpen}, this ignores `layer2EndsAt` so admins can fix assignments after the
 * optional Wednesday cap (actual voting still requires {@link isLayer2VotingOpen}).
 */
export function isLayer2AdminAssignmentAllowed(batch: {
  status: BatchStatus;
  winnersPublishedAt: Date | null;
}): boolean {
  if (batch.status !== BatchStatus.INTERNAL_VOTING) return false;
  if (batch.winnersPublishedAt != null) return false;
  return true;
}
