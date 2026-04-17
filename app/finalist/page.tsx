import Link from "next/link";
import { requireInternalOrAdmin } from "@/lib/guards";
import { getFinalistsByBatch, getScheduleBatches, batchStateLine } from "@/lib/program-batch-public";
import type { FinalistRow } from "@/lib/leaderboard-types";

export const dynamic = "force-dynamic";

function FinalistList({ rows, label }: { rows: FinalistRow[]; label: string }) {
  if (rows.length === 0) {
    return (
      <p className="terms-note">
        No top entries in <strong>{label}</strong> yet — normalized scores appear after Layer 1 voting completes for this
        batch.
      </p>
    );
  }
  return (
    <ul className="terms-list compact">
      {rows.map((r) => (
        <li key={`${r.email}-${r.rank}-${r.contentUrl}`}>
          <span className="admin-mono">#{r.rank}</span> {r.contentTitle} · {r.creatorName} · {r.email} ·{" "}
          {r.score != null ? r.score.toFixed(2) : "—"}{" "}
          <a href={r.contentUrl} target="_blank" rel="noopener noreferrer">
            View UGC
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function FinalistPage() {
  await requireInternalOrAdmin();

  const [batches, finalistsByBatch] = await Promise.all([getScheduleBatches(), getFinalistsByBatch()]);

  return (
    <main className="panel">
      <h2 className="section-h2">Finalist pool</h2>
      <p className="hero-lead">
        Layer 3 reference: top 10 submissions per category per batch by normalized score (internal logistics). Published
        winners remain on{" "}
        <Link href="/leaderboard" className="jump-link">
          Leaderboard
        </Link>
        .
      </p>

      {batches.length === 0 ? (
        <div className="card">
          <p className="terms-note">No program batches configured yet.</p>
        </div>
      ) : (
        batches.map((b) => {
          const f = finalistsByBatch[b.id];
          return (
            <section key={b.id} className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 className="card-title">
                <span className="title-icon">◇</span> {b.label}
              </h3>
              <p className="batch-state" style={{ marginBottom: "1rem" }}>
                {batchStateLine(b)}
              </p>
              {f ? (
                <>
                  <h4 className="terms-note" style={{ marginBottom: "0.5rem", textTransform: "none", letterSpacing: "normal" }}>
                    Mini Games
                  </h4>
                  <FinalistList rows={f.mini} label="Mini Games" />
                  <h4
                    className="terms-note"
                    style={{ marginTop: "1rem", marginBottom: "0.5rem", textTransform: "none", letterSpacing: "normal" }}
                  >
                    Real Life + Prompt
                  </h4>
                  <FinalistList rows={f.rl} label="Real Life + Prompt" />
                </>
              ) : (
                <p className="terms-note">Loading finalist data failed for this batch.</p>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
