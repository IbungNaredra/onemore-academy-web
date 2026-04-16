-- Peer vs Layer 2 admin assignments — enables pruning Layer 1 no-shows without touching admin-added voters.
CREATE TYPE "GroupVoterAssignmentSource" AS ENUM ('PEER_LAYER1', 'LAYER2_ADMIN');

ALTER TABLE "GroupVoterAssignment" ADD COLUMN "source" "GroupVoterAssignmentSource" NOT NULL DEFAULT 'PEER_LAYER1';
