import { prisma } from "@/lib/prisma";
import { requireParticipantVoteQueue } from "@/lib/guards";
import { redirect, notFound } from "next/navigation";
import { VoteGroupForm } from "@/components/vote-group-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VoteGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await requireParticipantVoteQueue(`/vote/${groupId}`);

  const group = await prisma.contentGroup.findUnique({
    where: { id: groupId },
    include: {
      submissions: { include: { submission: { include: { user: true } } } },
      assignments: { where: { userId: session.user.id } },
      batch: true,
    },
  });
  if (!group || group.assignments.length === 0) notFound();
  if (group.assignments[0]!.completed) {
    return (
      <main className="panel">
        <p>Already completed.</p>
        <Link href="/vote">Back</Link>
      </main>
    );
  }

  const rows = group.submissions.map((gs) => ({
    id: gs.submissionId,
    url: gs.submission.contentUrl,
    creator: gs.submission.user.name,
  }));

  return (
    <main className="panel">
      <h2 className="section-h2">
        {group.batch.label} · {group.category === "MINI_GAMES" ? "Mini Games" : "Real Life + Prompt"}
      </h2>
      <VoteGroupForm groupId={group.id} rows={rows} />
    </main>
  );
}
