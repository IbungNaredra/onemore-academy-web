import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { adminClearPublish, adminPublishWinners } from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PublishWinnersForm } from "@/components/publish-winners-form";
import { ContentCategory, Prisma, SubmissionStatus } from "@prisma/client";

type SubmissionWithUser = Prisma.SubmissionGetPayload<{ include: { user: true } }>;

function categoryLabel(c: ContentCategory) {
  return c === ContentCategory.MINI_GAMES ? "Mini Games" : "Real Life + Prompt";
}

export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  await requireAdmin();

  const batches = await prisma.programBatch.findMany({ orderBy: { batchNumber: "asc" } });

  const publishedRows =
    batches.length === 0
      ? []
      : await prisma.publishedWinner.findMany({
          where: { batchId: { in: batches.map((b) => b.id) } },
          select: { batchId: true, submissionId: true },
        });
  const publishedSubmissionIdsByBatch = publishedRows.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.batchId]) acc[row.batchId] = [];
    acc[row.batchId].push(row.submissionId);
    return acc;
  }, {});

  const byBatch: Record<string, SubmissionWithUser[]> = {};
  for (const b of batches) {
    byBatch[b.id] = await prisma.submission.findMany({
      where: { batchId: b.id, status: SubmissionStatus.ACTIVE },
      orderBy: [{ normalizedScore: "desc" }, { id: "asc" }],
      include: { user: true },
    });
  }

  return (
    <main className="panel">
      <h2 className="section-h2">Publish winners</h2>
      <p className="hero-lead">
        Pick winners with search (all active submissions in the batch). Un-publish clears winners for a batch.
      </p>
      {batches.map((b) => (
        <section key={b.id} className="card" style={{ marginBottom: "1.5rem" }}>
          <h3>{b.label}</h3>
          <PublishWinnersForm
            batchId={b.id}
            publishAction={async (fd: FormData) => {
              "use server";
              const ids = [...new Set(fd.getAll("ids").map(String))].filter(Boolean);
              await adminPublishWinners(b.id, ids);
            }}
            submissions={byBatch[b.id]!.map((s) => ({
              id: s.id,
              submitterName: s.user.name,
              email: s.user.email,
              categoryLabel: categoryLabel(s.category),
              scoreLabel: s.normalizedScore != null ? s.normalizedScore.toFixed(2) : "—",
            }))}
            publishedSubmissionIds={publishedSubmissionIdsByBatch[b.id] ?? []}
          />
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
