import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { BatchStatus } from "@prisma/client";
import { adminSetBatchSchedule, adminSetBatchStatus, adminToggleAutoTransition } from "@/app/actions/admin";

const BATCH_STATUS_OPTION_LABEL: Record<BatchStatus, string> = {
  [BatchStatus.CLOSED]: "CLOSED — competition not open yet",
  [BatchStatus.OPEN]: "OPEN — submissions open",
  [BatchStatus.VOTING]: "VOTING — peer voting",
  [BatchStatus.INTERNAL_VOTING]: "INTERNAL_VOTING — under review & Layer 2",
  [BatchStatus.CONCLUDED]: "CONCLUDED — pick winners / public leaderboard",
};
import { formatUtcAsShanghaiDatetimeLocal } from "@/lib/datetime-shanghai";
import { FormSubmitButton } from "@/components/form-submit-button";

export const dynamic = "force-dynamic";

export default async function AdminBatchPage() {
  await requireAdmin();

  const batches = await prisma.programBatch.findMany({ orderBy: { batchNumber: "asc" } });

  return (
    <main className="panel">
      <h2 className="section-h2">Batches</h2>
      <p className="hero-lead">
        Set the <strong>schedule</strong> (Asia/Shanghai): submissions while the batch is <strong>OPEN</strong> and now
        is in [<strong>Open</strong>, <strong>Voting start</strong>). At <strong>Voting start</strong> the batch becomes{" "}
        <strong>VOTING</strong> (cron or manual) and Layer 1 groups are prepared. At <strong>Peer voting ends</strong> (
        <code>concludedAt</code>) auto cron moves to <strong>INTERNAL_VOTING</strong> (UNDER_REVIEWED flagging, Layer 2).
        Move to <strong>CONCLUDED</strong> manually when internal review is done and you are ready to publish winners.
        Cron: GET <code>/api/cron/batch-transitions</code> with <code>CRON_SECRET</code> (CLOSED→OPEN at{" "}
        <code>openAt</code>, then OPEN→VOTING, VOTING→INTERNAL_VOTING).
      </p>

      {batches.map((b) => (
        <section key={b.id} className="card" style={{ marginBottom: "1rem" }}>
          <h3>
            {b.label} — {b.status} {b.voterAssignmentDone ? "· voters assigned" : "· voters not assigned"}
          </h3>
          <p className="terms-note">
            UTC (audit): OPEN {b.openAt.toISOString()} · VOTING {b.votingAt.toISOString()} · PEER_VOTING_END{" "}
            {b.concludedAt.toISOString()}
            {b.leaderboardPublishAt ? ` · PUBLISH ${b.leaderboardPublishAt.toISOString()}` : ""}
          </p>

          <form action={adminSetBatchSchedule.bind(null, b.id)} className="admin-schedule-form">
            <h4 className="admin-schedule-heading">Schedule (Asia/Shanghai, UTC+8)</h4>
            <p className="terms-note" style={{ marginBottom: "0.75rem" }}>
              Submissions are allowed when status is OPEN and now is in [Open, Voting start).
            </p>
            <div className="admin-schedule-grid">
              <div className="form-field">
                <label htmlFor={`open-${b.id}`}>Open — submissions start</label>
                <input
                  id={`open-${b.id}`}
                  type="datetime-local"
                  name="openAt"
                  className="admin-input"
                  defaultValue={formatUtcAsShanghaiDatetimeLocal(b.openAt)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor={`voting-${b.id}`}>Voting start</label>
                <input
                  id={`voting-${b.id}`}
                  type="datetime-local"
                  name="votingAt"
                  className="admin-input"
                  defaultValue={formatUtcAsShanghaiDatetimeLocal(b.votingAt)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor={`concluded-${b.id}`}>Peer voting ends → INTERNAL_VOTING</label>
                <input
                  id={`concluded-${b.id}`}
                  type="datetime-local"
                  name="concludedAt"
                  className="admin-input"
                  defaultValue={formatUtcAsShanghaiDatetimeLocal(b.concludedAt)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor={`publish-${b.id}`}>Leaderboard publish (optional)</label>
                <input
                  id={`publish-${b.id}`}
                  type="datetime-local"
                  name="leaderboardPublishAt"
                  className="admin-input"
                  defaultValue={
                    b.leaderboardPublishAt ? formatUtcAsShanghaiDatetimeLocal(b.leaderboardPublishAt) : ""
                  }
                />
              </div>
            </div>
            <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Saving…">
              Save schedule
            </FormSubmitButton>
          </form>

          <div className="admin-batch-actions">
            <form
              className="admin-toolbar-form"
              action={async (fd: FormData) => {
                "use server";
                await adminSetBatchStatus(b.id, String(fd.get("status")) as BatchStatus);
              }}
            >
              <select name="status" defaultValue={b.status} className="admin-input">
                {Object.values(BatchStatus).map((s) => (
                  <option key={s} value={s}>
                    {BATCH_STATUS_OPTION_LABEL[s]}
                  </option>
                ))}
              </select>
              <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Applying…">
                Set status
              </FormSubmitButton>
            </form>
            <form
              action={async () => {
                "use server";
                await adminToggleAutoTransition(b.id, !b.autoTransition);
              }}
            >
              <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Updating…">
                Auto transition: {b.autoTransition ? "ON" : "OFF"}
              </FormSubmitButton>
            </form>
          </div>
        </section>
      ))}
    </main>
  );
}
