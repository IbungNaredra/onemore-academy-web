-- Persist Layer 1 peer roster counts at end of peer voting (before no-show prune)
-- so completionRate / UNDER_REVIEWED reflect true participation (done / full roster).
ALTER TABLE "ContentGroup" ADD COLUMN "peerLayer1TotalAtClose" INTEGER;
ALTER TABLE "ContentGroup" ADD COLUMN "peerLayer1CompletedAtClose" INTEGER;
