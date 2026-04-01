import type { ProgramBatch } from "@prisma/client";

/**
 * Map Google Form col E (fixed multiple choice) to ProgramBatch.id.
 * Options look like: "Batch 1 (30th April - 4th May 2026)", etc.
 * Match batch number in order 3 → 2 → 1 so "batch 1" does not substring-match wrongly.
 */
export function findBatchIdFromSelfDeclared(
  declared: string | null | undefined,
  batches: Pick<ProgramBatch, "id" | "slug">[],
): string | null {
  if (!declared?.trim()) return null;
  const t = declared.toLowerCase();
  if (/\bbatch\s*3\b/.test(t)) {
    return batches.find((b) => b.slug === "batch-3")?.id ?? null;
  }
  if (/\bbatch\s*2\b/.test(t)) {
    return batches.find((b) => b.slug === "batch-2")?.id ?? null;
  }
  if (/\bbatch\s*1\b/.test(t)) {
    return batches.find((b) => b.slug === "batch-1")?.id ?? null;
  }
  return null;
}
