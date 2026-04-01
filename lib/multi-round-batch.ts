import { ContentType, type ProgramBatch } from "@prisma/client";

/** Per–content-type multi-round (cuts + runoffs). The other type can stay a single classic pool. */
export function batchUsesMultiRoundForType(batch: ProgramBatch, ct: ContentType): boolean {
  return ct === ContentType.MINI_GAMES
    ? batch.multiRoundMiniGames
    : batch.multiRoundInteractive;
}
