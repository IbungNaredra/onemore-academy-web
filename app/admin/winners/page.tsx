import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { adminClearPublish, adminPublishWinners } from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Prisma, SubmissionStatus } from "@prisma/client";

type SubmissionWithUser = Prisma.SubmissionGetPayload<{ include: { user: true } }>;

export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  await requireAdmin();

  const batches = await prisma.programBatch.findMany({ orderBy: { batchNumber: "asc" } });

  const byBatch: Record<string, SubmissionWithUser[]> = {};
  for (const b of batches) {
    byBatch[b.id] = await prisma.submission.findMany({
      where: { batchId: b.id, status: SubmissionStatus.ACTIVE },
      orderBy: [{ normalizedScore: "desc" }, { id: "asc" }],
      take: 30,
      include: { user: true },
    });
  }

  return (
    <main className="panel">
      <h2 className="section-h2">Publish winners</h2>
      <p className="hero-lead">Paste comma-separated submission IDs. Un-publish clears winners for a batch.</p>
      {batches.map((b) => (
        <section key={b.id} className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>{b.label}</h3>
          <form
            action={async (fd: FormData) => {
              "use server";
              const raw = String(fd.get("ids") ?? "");
              const ids = raw
                .split(/[\s,]+/)
                .map((x) => x.trim())
                .filter(Boolean);
              await adminPublishWinners(b.id, ids);
            }}
          >
            <p className="terms-note">Submission IDs:</p>
            <textarea name="ids" className="admin-input" rows={3} placeholder="cuid1, cuid2, ..." />
            <ul className="terms-list compact">
              {byBatch[b.id]!.map((s) => (
                <li key={s.id}>
                  <code>{s.id}</code> · {s.user.name} · {s.normalizedScore?.toFixed(2) ?? "—"}
                </li>
              ))}
            </ul>
            <FormSubmitButton type="submit" className="cta-btn" pendingLabel="Publishing…">
              Publish
            </FormSubmitButton>
          </form>
          <form
            action={async () => {
              "use server";
              await adminClearPublish(b.id);
            }}
            style={{ marginTop: 8 }}
          >
            <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Updating…">
              Un-publish this batch
            </FormSubmitButton>
          </form>
        </section>
      ))}
    </main>
  );
}
