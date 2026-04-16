import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  adminAssignLayer2Voters,
  adminReevaluateUnderReviewed,
  adminUnassignAllLayer2Voters,
  adminUnassignLayer2Voter,
} from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Layer2VoterAssignForm } from "@/components/layer2-voter-assign-form";
import { additionalVotersToReachHalf } from "@/lib/under-reviewed-metrics";
import { BatchStatus, UserRole, ContentCategory, GroupValidity } from "@prisma/client";

export const dynamic = "force-dynamic";

function catLabel(c: ContentCategory) {
  return c === "MINI_GAMES" ? "Mini Games" : "Real Life + Prompt";
}

export default async function AdminUnderReviewedPage() {
  await requireAdmin();

  const [recalcBatches, groups, assignableUsers] = await Promise.all([
    prisma.programBatch.findMany({
      where: { status: { in: [BatchStatus.INTERNAL_VOTING, BatchStatus.CONCLUDED] } },
      orderBy: { batchNumber: "asc" },
    }),
    prisma.contentGroup.findMany({
      where: {
        layer: 1,
        validityStatus: GroupValidity.UNDER_REVIEWED,
        batch: { status: BatchStatus.INTERNAL_VOTING },
      },
      include: {
        batch: true,
        submissions: true,
        assignments: { include: { user: { select: { email: true, name: true, role: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: [UserRole.INTERNAL_TEAM, UserRole.FALLBACK_VOTER] } },
      orderBy: { email: "asc" },
    }),
  ]);

  const assignableSorted = [...assignableUsers].sort((a, b) => {
    const rank = (r: UserRole) => (r === UserRole.INTERNAL_TEAM ? 0 : r === UserRole.FALLBACK_VOTER ? 1 : 2);
    const d = rank(a.role) - rank(b.role);
    if (d !== 0) return d;
    return a.email.localeCompare(b.email);
  });

  return (
    <main className="panel admin-wide">
      <h2 className="section-h2">Layer 2 — UNDER_REVIEWED</h2>
      <p className="hero-lead">
        When peer voting ends, the batch moves to <strong>INTERNAL_VOTING</strong> (auto at{" "}
        <code>concludedAt</code> or manual). Groups below 50% completion are flagged <strong>UNDER_REVIEWED</strong>.
        Assign internal team and/or fallback voters; they vote in the same UI (Layer 2 closes when winners are published
        or <code>layer2EndsAt</code> passes). Set the batch to <strong>CONCLUDED</strong> when internal review is done and
        you are ready to pick winners for the public leaderboard.
      </p>

      <section className="card" style={{ marginBottom: "1.25rem" }}>
        <h3 className="card-title">Recalculate completion (internal voting or concluded batches)</h3>
        <p className="terms-note" style={{ marginBottom: "0.75rem" }}>
          Re-runs the same 50% rule as cron / status change (manual parity).
        </p>
        {recalcBatches.length === 0 ? (
          <p className="terms-note">No INTERNAL_VOTING or CONCLUDED batches.</p>
        ) : (
          <ul className="terms-list compact">
            {recalcBatches.map((b) => (
              <li key={b.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span>{b.label}</span>
                <form action={adminReevaluateUnderReviewed.bind(null, b.id)}>
                  <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Working…">
                    Recalculate
                  </FormSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.length === 0 ? (
        <div className="card">
          <p className="terms-note">No UNDER_REVIEWED groups right now.</p>
        </div>
      ) : (
        groups.map((g) => {
          const done = g.assignments.filter((a) => a.completed).length;
          const total = g.assignments.length;
          const rate = total === 0 ? 0 : done / total;
          const need = additionalVotersToReachHalf(done, total);
          return (
            <section key={g.id} className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 className="card-title">
                {g.batch.label} · {catLabel(g.category)}
              </h3>
              <p className="terms-note">
                <code className="admin-mono">{g.id}</code> · submissions in group: {g.submissions.length} · completion:{" "}
                {(rate * 100).toFixed(0)}% ({done}/{total}) · suggested extra voters to reach 50%: <strong>{need}</strong>
              </p>
              <Layer2VoterAssignForm
                groupId={g.id}
                assignAction={adminAssignLayer2Voters.bind(null, g.id)}
                unassignAction={adminUnassignLayer2Voter.bind(null, g.id)}
                unassignAllAction={adminUnassignAllLayer2Voters.bind(null, g.id)}
                assignableUsers={assignableSorted.map((u) => ({
                  id: u.id,
                  email: u.email,
                  name: u.name,
                  role: u.role,
                }))}
                assignedUserIds={g.assignments.map((a) => a.userId)}
                assignmentChips={g.assignments.map((a) => ({
                  userId: a.userId,
                  email: a.user.email,
                  name: a.user.name,
                  role: a.user.role,
                }))}
              />
            </section>
          );
        })
      )}
    </main>
  );
}
