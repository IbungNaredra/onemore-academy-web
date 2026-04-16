import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireParticipantVoteQueue } from "@/lib/guards";
import { pendingVoteGroupsWhere } from "@/lib/vote-queue-where";
import type { AppRole } from "@/auth";

export const dynamic = "force-dynamic";

function pickRandom<T>(items: T[]): T {
  const i = Math.floor(Math.random() * items.length);
  return items[i]!;
}

function voteQueueRole(role: AppRole): "participant" | "fallback_voter" | "internal_team" {
  if (role === "fallback_voter") return "fallback_voter";
  if (role === "internal_team") return "internal_team";
  return "participant";
}

export default async function VoteHubPage() {
  const session = await requireParticipantVoteQueue();

  const where = pendingVoteGroupsWhere(session.user.id, voteQueueRole(session.user.role));

  const groups = await prisma.contentGroup.findMany({
    where,
    include: {
      batch: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (groups.length === 0) {
    return (
      <main className="panel">
        <h2 className="section-h2">Vote queue</h2>
        <p className="hero-lead">Complete all 1–5 scores in a group, then submit in one step.</p>
        <p className="terms-note">
          No pending groups — if the batch is <strong>CLOSED</strong>, the competition is not open yet (no voting).
          During peer voting (batch VOTING), check back after assignment. For Layer 2 (UNDER_REVIEWED), ensure the batch is
          INTERNAL_VOTING and you have an assignment from admin.
        </p>
      </main>
    );
  }

  redirect(`/vote/${pickRandom(groups).id}`);
}
