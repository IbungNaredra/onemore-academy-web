import { ContentType } from "@prisma/client";
import type { ProgramBatch } from "@prisma/client";

const DEFAULT_CUTS = [4, 2];

export function parseRoundCutsJson(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [...DEFAULT_CUTS];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length === 0) return [...DEFAULT_CUTS];
    const nums = v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 1);
    return nums.length > 0 ? nums : [...DEFAULT_CUTS];
  } catch {
    return [...DEFAULT_CUTS];
  }
}

export function getRoundCutsForContentType(batch: ProgramBatch, ct: ContentType): number[] {
  const raw = ct === ContentType.MINI_GAMES ? batch.roundCutsMini : batch.roundCutsInteractive;
  return parseRoundCutsJson(raw);
}
