import { prisma } from "@/lib/prisma";
import { requireParticipantVoteQueue } from "@/lib/guards";
import { notFound } from "next/navigation";
import { VoteGroupForm } from "@/components/vote-group-form";
import Link from "next/link";
import { assignedVoteGroupsWhere, pendingVoteGroupsWhere } from "@/lib/vote-queue-where";
import type { AppRole } from "@/auth";
import { GroupValidity } from "@prisma/client";
import { submissionDisplayTitle } from "@/lib/submission-display";

export const dynamic = "force-dynamic";

function voteQueueRole(role: AppRole): "participant" | "fallback_voter" | "internal_team" {
  if (role === "fallback_voter") return "fallback_voter";
  if (role === "internal_team") return "internal_team";
  return "participant";
}

export default async function VoteGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await requireParticipantVoteQueue(`/vote/${groupId}`);

  const role = voteQueueRole(session.user.role);
  const accessWhere = pendingVoteGroupsWhere(session.user.id, role);
  const assignedWhere = assignedVoteGroupsWhere(session.user.id, role);

  const [group, pendingCount, assignedCount] = await Promise.all([
    prisma.contentGroup.findFirst({
    where: {
      id: groupId,
      ...accessWhere,
    },
      include: {
        submissions: { include: { submission: { include: { user: true } } } },
        assignments: { where: { userId: session.user.id } },
        batch: true,
      },
    }),
    prisma.contentGroup.count({ where: accessWhere }),
    prisma.contentGroup.count({ where: assignedWhere }),
  ]);

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
    creator: submissionDisplayTitle(gs.submission.contentTitle, gs.submission.user.name),
  }));

  const completedCount = Math.max(0, assignedCount - pendingCount);

  return (
    <main className="panel">
      <header className="vote-group-page-head">
        <h2 className="section-h2 vote-group-page-head__title">
          {group.batch.label} · {group.category === "MINI_GAMES" ? "Mini Games" : "Real Life + Prompt"}
          {group.validityStatus === GroupValidity.UNDER_REVIEWED ? " · Layer 2 (UNDER_REVIEWED)" : ""}
        </h2>
        <p
          className="vote-mission-badge"
          aria-label={`Voting progress: ${completedCount} of ${assignedCount} groups completed`}
        >
          <span className="vote-mission-badge__value">
            {completedCount}/{assignedCount}
          </span>
        </p>
      </header>
      <VoteGroupForm groupId={group.id} rows={rows} />
    </main>
  );
}
