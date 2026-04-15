import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireParticipantVoteQueue } from "@/lib/guards";

export const dynamic = "force-dynamic";

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

  return (
    <main className="panel">
      <h2 className="section-h2">Vote queue</h2>
      <p className="hero-lead">Complete all 1–5 scores in a group, then submit in one step.</p>
      {groups.length === 0 ? (
        <p className="terms-note">No pending groups — check back after admin runs voter assignment for VOTING.</p>
      ) : (
        <ul className="terms-list">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/vote/${g.id}`}>
                {g.batch.label} · {g.category === "MINI_GAMES" ? "Mini Games" : "Real Life + Prompt"} · group
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
