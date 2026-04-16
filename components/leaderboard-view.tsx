"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  batchStateLine,
  type FinalistRow,
  type LeaderboardBatchDto,
  type WinnerEntryDto,
} from "@/lib/leaderboard-types";

function TypeSection({ label, winners }: { label: string; winners: WinnerEntryDto[] }) {
  return (
    <section className="card type-section">
      <h3 className="card-title">
        <span className="title-icon">◇</span> {label}
      </h3>
      <div className="winner-list">
        {winners.map((item) => (
          <article className="winner-item" key={`${item.creatorEmail}-${item.contentUrl}`}>
            <p className="winner-item-name">{item.creatorName}</p>
            <p className="winner-item-meta">{item.creatorEmail}</p>
            <p className="winner-item-type">{item.contentType}</p>
            {item.normalizedScore != null && (
              <p className="winner-item-score">Score: {item.normalizedScore.toFixed(2)} / 5.0</p>
            )}
            <a className="winner-item-link" href={item.contentUrl} target="_blank" rel="noopener noreferrer">
              View UGC
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LeaderboardView({
  batches,
  finalistsByBatch,
  showInternal,
}: {
  batches: LeaderboardBatchDto[];
  finalistsByBatch?: Record<string, { mini: FinalistRow[]; rl: FinalistRow[] }>;
  showInternal?: boolean;
}) {
  const [activeId, setActiveId] = useState(batches[0]?.id ?? "");

  const batch = useMemo(
    () => batches.find((b) => b.id === activeId) ?? batches[0],
    [activeId, batches],
  );

  if (batches.length === 0) {
    return (
      <div className="card leaderboard-empty">
        <h3 className="card-title">
          <span className="title-icon">◇</span> No batches yet
        </h3>
        <p className="hero-lead">Run migrations and <code>npm run db:seed</code>.</p>
      </div>
    );
  }

  if (!batch) return null;

  const publishedReady = batch.state === "published";
  const isClosed = batch.state === "closed";
  const hasWinners = batch.miniGames.length > 0 || batch.realLifePrompt.length > 0;

  return (
    <>
      <div className="winners-head">
        <h2 className="section-h2">Winner of the Week</h2>
        <p className="section-desc">Mini Games and Real Life + Prompt · scores shown after publish (PRD v2.2).</p>
      </div>

      <div className="week-picker" role="tablist" aria-label="Select batch">
        {batches.map((b) => (
          <button
            key={b.id}
            type="button"
            className="week-btn"
            role="tab"
            aria-selected={b.id === batch.id}
            onClick={() => setActiveId(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="batch-state">{batchStateLine(batch)}</p>

      {isClosed ? (
        <div className="card leaderboard-empty">
          <h3 className="card-title">
            <span className="title-icon">◇</span> Competition not open yet
          </h3>
          <p className="hero-lead">
            This batch is <strong>closed</strong> until the submission window opens. Submissions and voting are disabled.
            Check the schedule on <Link href="/info">Challenge info</Link> for opening times.
          </p>
        </div>
      ) : !publishedReady ? (
        <div className="card leaderboard-empty">
          <h3 className="card-title">
            <span className="title-icon">◇</span> Results not published yet
          </h3>
          <p className="hero-lead">
            Announcement: <strong>{batch.announcementDate ?? "TBD"}</strong> (Beijing time).
          </p>
        </div>
      ) : !hasWinners ? (
        <div className="card leaderboard-empty">
          <h3 className="card-title">
            <span className="title-icon">◇</span> No published winners
          </h3>
          <p className="hero-lead">Admin must publish winners for this batch.</p>
        </div>
      ) : (
        <div className="winner-grid">
          <TypeSection label="Mini Games" winners={batch.miniGames} />
          <TypeSection label="Real Life + Prompt" winners={batch.realLifePrompt} />
        </div>
      )}

      {showInternal && publishedReady && finalistsByBatch && (
        <section className="card" style={{ marginTop: "2rem" }}>
          <h3 className="card-title">
            <span className="title-icon">◇</span> Internal — Top 10 (logistics)
          </h3>
          {(() => {
            const f = finalistsByBatch[batch.id];
            if (!f) return null;
            return (
              <>
                <h4>Mini Games</h4>
                <ul className="terms-list compact">
                  {f.mini.map((r) => (
                    <li key={r.email + r.rank}>
                      #{r.rank} {r.name} · {r.email} · {r.score?.toFixed(2) ?? "—"}{" "}
                      <a href={r.contentUrl} target="_blank" rel="noreferrer">
                        link
                      </a>
                    </li>
                  ))}
                </ul>
                <h4>Real Life + Prompt</h4>
                <ul className="terms-list compact">
                  {f.rl.map((r) => (
                    <li key={r.email + r.rank}>
                      #{r.rank} {r.name} · {r.email} · {r.score?.toFixed(2) ?? "—"}{" "}
                      <a href={r.contentUrl} target="_blank" rel="noreferrer">
                        link
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </section>
      )}
    </>
  );
}
