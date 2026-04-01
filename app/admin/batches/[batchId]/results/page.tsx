import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { adminResetVote, applyRoundRobin } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/guards";
import {
  getAggregatedScoresForBatch,
  getJudgeBracketCompletion,
  getVotesForBatch,
} from "@/lib/admin-insights";
import { prisma } from "@/lib/prisma";
import { ContentType } from "@prisma/client";

function labelContentType(ct: ContentType) {
  return ct === ContentType.MINI_GAMES ? "Mini Games" : "Interactive Content";
}

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function BatchResultsPage(props: PageProps) {
  await requireAdmin();
  const { batchId } = await props.params;

  const batch = await prisma.programBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch) notFound();

  const [agg, completion, votes] = await Promise.all([
    getAggregatedScoresForBatch(batchId),
    getJudgeBracketCompletion(batchId),
    getVotesForBatch(batchId),
  ]);

  return (
    <main className="panel-page admin-wide">
      <AdminNav />
      <h2>
        Results — {batch.label}{" "}
        <code className="admin-mono">{batch.slug}</code>
      </h2>
      <p className="admin-lead">
        PRD §8.4: aggregated scores (admin only).{" "}
        {batch.judgingLockedAt != null
          ? "Batch judging is locked."
          : "Lock judging on the batch page when you want scores to be final."}{" "}
        Public leaderboard still uses <strong>published winners</strong> only (no public score totals).
      </p>

      <p className="admin-footer-row">
        <Link href="/admin/batches">← Batches</Link>
      </p>

      <section className="admin-batch-section">
        <h4>Round-robin (PRD §6)</h4>
        <p className="admin-hint">
          Distributes submissions evenly across existing brackets of the same content type (by creation order).
        </p>
        <div className="admin-row-form">
          <form action={applyRoundRobin}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="contentType" value="MINI_GAMES" />
            <button type="submit" className="btn-ghost btn-small">
              Redistribute Mini Games
            </button>
          </form>
          <form action={applyRoundRobin}>
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="contentType" value="INTERACTIVE_CONTENT" />
            <button type="submit" className="btn-ghost btn-small">
              Redistribute Interactive
            </button>
          </form>
        </div>
      </section>

      <section className="admin-batch-section">
        <h4>Judge completion (X / Y per judge per bracket)</h4>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-compact">
            <thead>
              <tr>
                <th>Bracket</th>
                <th>Judge</th>
                <th>Scored</th>
              </tr>
            </thead>
            <tbody>
              {completion.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-empty">
                    No bracket assignments yet.
                  </td>
                </tr>
              ) : (
                completion.map((c) => (
                  <tr key={`${c.bracketId}-${c.judgeId}`}>
                    <td>
                      {labelContentType(c.contentType)} · order {c.sortOrder}
                    </td>
                    <td>{c.judgeName ?? c.judgeEmail}</td>
                    <td>
                      <strong>{c.scored}</strong> / {c.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-batch-section">
        <h4>Aggregated scores — {labelContentType(ContentType.MINI_GAMES)}</h4>
        <ScoreTable rows={agg.miniGames} />
      </section>

      <section className="admin-batch-section">
        <h4>Aggregated scores — {labelContentType(ContentType.INTERACTIVE_CONTENT)}</h4>
        <ScoreTable rows={agg.interactive} />
      </section>

      <section className="admin-batch-section">
        <h4>Reset individual vote (PRD §8.6)</h4>
        <p className="admin-hint">Deletes one judge&apos;s score so they can vote again.</p>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-compact">
            <thead>
              <tr>
                <th>Judge</th>
                <th>Creator</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {votes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    No votes for this batch yet.
                  </td>
                </tr>
              ) : (
                votes.map((v) => (
                  <tr key={v.voteId}>
                    <td>{v.judgeEmail}</td>
                    <td>{v.creatorName}</td>
                    <td>{v.score}</td>
                    <td>
                      <form action={adminResetVote} className="admin-inline">
                        <input type="hidden" name="voteId" value={v.voteId} />
                        <input type="hidden" name="batchId" value={batchId} />
                        <button type="submit" className="btn-danger-ghost btn-small">
                          Reset
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="admin-footer-row">
        <Link href="/admin/batches">← Batches</Link>
        <SignOutButton />
      </p>
    </main>
  );
}

function ScoreTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getAggregatedScoresForBatch>>["miniGames"];
}) {
  if (rows.length === 0) {
    return <p className="admin-empty">No submissions in this pool.</p>;
  }
  return (
    <table className="admin-table admin-table-compact">
      <thead>
        <tr>
          <th>Creator</th>
          <th>Sum</th>
          <th># votes</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.submissionId}>
            <td>{r.creatorName}</td>
            <td>
              <strong>{r.totalScore}</strong>
            </td>
            <td>{r.judgeVotes}</td>
            <td>
              <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
                UGC
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
