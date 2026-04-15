import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { BatchStatus } from "@prisma/client";
import { adminRunPrepareVoting, adminSetBatchStatus, adminToggleAutoTransition } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminBatchPage() {
  await requireAdmin();

  const batches = await prisma.programBatch.findMany({ orderBy: { batchNumber: "asc" } });

  return (
    <main className="panel">
      <h2 className="section-h2">Batches</h2>
      <p className="hero-lead">
        Before VOTING: run <strong>Prepare voting</strong> (eligibility + groups). Cron: GET{" "}
        <code>/api/cron/batch-transitions</code> with <code>CRON_SECRET</code>.
      </p>
      {batches.map((b) => (
        <section key={b.id} className="card" style={{ marginBottom: "1rem" }}>
          <h3>
            {b.label} — {b.status} {b.voterAssignmentDone ? "· voters assigned" : "· voters not assigned"}
          </h3>
          <p className="terms-note">
            OPEN {b.openAt.toISOString()} · VOTING {b.votingAt.toISOString()} · CONCLUDED {b.concludedAt.toISOString()}
          </p>
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
                    {s}
                  </option>
                ))}
              </select>
              <button type="submit" className="admin-table-btn">
                Set status
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await adminToggleAutoTransition(b.id, !b.autoTransition);
              }}
            >
              <button type="submit" className="admin-table-btn">
                Auto transition: {b.autoTransition ? "ON" : "OFF"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await adminRunPrepareVoting(b.id);
              }}
            >
              <button type="submit" className="cta-btn">
                Prepare voting (groups)
              </button>
            </form>
          </div>
        </section>
      ))}
    </main>
  );
}
