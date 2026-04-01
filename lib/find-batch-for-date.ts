import type { ProgramBatch } from "@prisma/client";

/** Optional: assign batch from col A timestamp vs submission window (not used by Sheets sync — sync uses col E). */
export function findBatchIdForSubmissionDate(
  submittedAt: Date,
  batches: Pick<ProgramBatch, "id" | "submissionStart" | "submissionEnd">[],
): string | null {
  const t = submittedAt.getTime();
  for (const b of batches) {
    const start = b.submissionStart.getTime();
    const end = b.submissionEnd.getTime();
    if (t >= start && t <= end) return b.id;
  }
  return null;
}
