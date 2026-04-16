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
import {
  additionalAssigneesIfRosterGrows,
  additionalAssigneesToReachHalfOfPeerRoster,
} from "@/lib/under-reviewed-metrics";
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
        // Match batches eligible for "Recalculate": INTERNAL_VOTING (Layer 2 open) or CONCLUDED
        // (stranded UNDER_REVIEWED groups still visible; assign requires INTERNAL_VOTING — see card note).
        batch: { status: { in: [BatchStatus.INTERNAL_VOTING, BatchStatus.CONCLUDED] } },
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
        <code>concludedAt</code> or manual). Groups below 50% peer completion (after no-shows are pruned) are flagged{" "}
        <strong>UNDER_REVIEWED</strong> — <em>only those groups appear below</em>; other groups in the same batch may
        still be <strong>VALID</strong> and are not listed. Assign internal team and/or fallback voters; they vote in the
        same UI (Layer 2 closes when winners are published or <code>layer2EndsAt</code> passes). Set the batch to{" "}
        <strong>CONCLUDED</strong> when internal review is done and you are ready to pick winners for the public
        leaderboard.
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
          const assignDone = g.assignments.filter((a) => a.completed).length;
          const assignTotal = g.assignments.length;
          // Peer-phase 50% rule uses snapshot at end of peer voting (before no-show prune); show that when stored.
          const peerDone = g.peerLayer1CompletedAtClose ?? 0;
          const peerTotal = g.peerLayer1TotalAtClose;
          const showPeerSnapshot = peerTotal != null && peerTotal > 0;
          const done = showPeerSnapshot ? peerDone : assignDone;
          const total = showPeerSnapshot ? peerTotal : assignTotal;
          const rate = total === 0 ? 0 : done / total;
          // Suggested adds: use current roster if any; else peer snapshot (roster was fully pruned).
          const needBasisDone = assignTotal > 0 ? assignDone : done;
          const needBasisTotal = assignTotal > 0 ? assignTotal : total;
          const needPeerHalf = additionalAssigneesToReachHalfOfPeerRoster(needBasisDone, needBasisTotal);
          const needIfRosterGrows = additionalAssigneesIfRosterGrows(needBasisDone, needBasisTotal);
          const batchConcluded = g.batch.status === BatchStatus.CONCLUDED;
          return (
            <section key={g.id} className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 className="card-title">
                {g.batch.label} · {catLabel(g.category)}
              </h3>
              {batchConcluded && (
                <p className="terms-note" style={{ marginBottom: "0.5rem" }}>
                  Batch status is <strong>CONCLUDED</strong> — use <strong>Recalculate</strong> above if needed. To assign
                  Layer 2 voters, set the batch back to <strong>INTERNAL_VOTING</strong> (assign actions are blocked while
                  CONCLUDED).
                </p>
              )}
              <p className="terms-note">
                <code className="admin-mono">{g.id}</code> · submissions in group: {g.submissions.length} · peer completion
                at close: {(rate * 100).toFixed(0)}% ({done}/{total}){showPeerSnapshot ? " — counts peer roster at end of peer voting" : ""}{" "}
                · suggested assignees (reach ⌈peer roster/2⌉ completed votes vs original peer size N):{" "}
                <strong>{needPeerHalf}</strong>
                {needIfRosterGrows !== needPeerHalf && (
                  <>
                    {" "}
                    <span className="terms-note">
                      (if each new assignee permanently grows the roster and all complete, a different bound is{" "}
                      <strong>{needIfRosterGrows}</strong> — usually not the planning number.)
                    </span>
                  </>
                )}
              </p>
              {assignTotal === 0 && (
                <p className="terms-note" style={{ marginTop: "0.5rem" }}>
                  <strong>0/0</strong> means there are no voter roster rows left on this group (incomplete peer voters
                  were removed at internal voting). Assign internal team / fallback voters below to build the Layer 2
                  roster — completion will then reflect those assignments.
                </p>
              )}
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
