import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireParticipantVoteQueue } from "@/lib/guards";

export const dynamic = "force-dynamic";

function pickRandom<T>(items: T[]): T {
  const i = Math.floor(Math.random() * items.length);
  return items[i]!;
}

export default async function VoteHubPage() {
  const session = await requireParticipantVoteQueue();

  const groups = await prisma.contentGroup.findMany({
    where: {
      layer: 1,
      assignments: {
        some: {
          userId: session.user.id,
          completed: false,
        },
      },
    },
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
        <p className="terms-note">No pending groups — check back after admin runs voter assignment for VOTING.</p>
      </main>
    );
  }

  redirect(`/vote/${pickRandom(groups).id}`);
}
