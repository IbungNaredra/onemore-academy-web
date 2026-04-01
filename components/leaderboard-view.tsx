"use client";

import { useMemo, useState } from "react";
import {
  batchStateLine,
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
          <article className="winner-item" key={`${item.creatorName}-${item.awardName}-${item.contentUrl}`}>
            <p className="winner-item-name">{item.creatorName}</p>
            <p className="winner-item-award">{item.awardName}</p>
            <p className="winner-item-type">{item.contentType}</p>
            <a className="winner-item-link" href={item.contentUrl} target="_blank" rel="noopener noreferrer">
              View UGC
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LeaderboardView({ batches }: { batches: LeaderboardBatchDto[] }) {
  const [activeId, setActiveId] = useState(batches[0]?.id ?? "");

  const batch = useMemo(
    () => batches.find((b) => b.id === activeId) ?? batches[0],
    [activeId, batches]
  );

  if (batches.length === 0) {
    return (
      <div className="card leaderboard-empty">
        <h3 className="card-title">
          <span className="title-icon">◇</span> No batches yet
        </h3>
        <p className="hero-lead">Add program batches in the database (or run <code>npm run db:seed</code>).</p>
      </div>
    );
  }

  if (!batch) return null;

  const publishedReady = batch.state === "published";
  const hasWinners = batch.miniGames.length > 0 || batch.interactiveContent.length > 0;

  return (
    <>
      <div className="winners-head">
        <h2 className="section-h2">Weekly leaderboard</h2>
        <p className="section-desc">
          Data from the database · Mini Games and Interactive Content · name, award, and link only.
        </p>
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

      {!publishedReady ? (
        <div className="card leaderboard-empty">
          <h3 className="card-title">
            <span className="title-icon">◇</span> Results are not public yet
          </h3>
          <p className="hero-lead">
            This batch is currently <strong>{batch.state}</strong>. Winners will be shown on{" "}
            {batch.announcementDate ?? "the announcement date"} after admin publish.
          </p>
        </div>
      ) : !hasWinners ? (
        <div className="card leaderboard-empty">
          <h3 className="card-title">
            <span className="title-icon">◇</span> No published winners
          </h3>
          <p className="hero-lead">
            This batch is published but has no winner rows yet. Add them under Admin → Batches.
          </p>
        </div>
      ) : (
        <div className="winner-grid">
          <TypeSection label="Mini Games" winners={batch.miniGames} />
          <TypeSection label="Interactive Content" winners={batch.interactiveContent} />
        </div>
      )}
    </>
  );
}
