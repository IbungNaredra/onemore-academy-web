"use client";

import { useState } from "react";
import { submitGroupRatings } from "@/app/actions/vote";
import { useSnackbar } from "@/components/snackbar-context";
import { StarRating } from "@/components/star-rating";

type Row = { id: string; url: string; creator: string };

export function VoteGroupForm({ groupId, rows }: { groupId: string; rows: Row[] }) {
  const { showError, showSuccess } = useSnackbar();
  const [scores, setScores] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, null])),
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const r of rows) {
      const sc = scores[r.id];
      if (sc == null || sc < 1 || sc > 5) {
        showError("Please give every entry a star rating from 1 to 5.");
        return;
      }
    }
    const payload: Record<string, number> = {};
    for (const r of rows) {
      payload[r.id] = scores[r.id]!;
    }
    setPending(true);
    try {
      const res = await submitGroupRatings(groupId, payload);
      if (res.error) {
        showError(res.error);
        setPending(false);
        return;
      }
      showSuccess("Scores saved.");
      // Full navigation: client router can complete before paint, re-enabling the button and
      // allowing a second submit ("Already submitted"). assign() leaves the page in one step.
      window.location.assign("/vote");
    } catch {
      showError("Could not save scores. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      {rows.map((r) => (
        <div key={r.id} style={{ marginBottom: "1rem" }}>
          <div className="vote-row-head">
            <strong className="vote-row-head__title">{r.creator}</strong>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-btn cta-btn--inline"
            >
              Open content
            </a>
          </div>
          <p className="vote-rate-hint">Rate 1–5</p>
          <StarRating
            label={r.creator}
            value={scores[r.id] ?? null}
            onChange={(n) => setScores((s) => ({ ...s, [r.id]: n }))}
          />
        </div>
      ))}
      <button
        type="submit"
        className={`cta-btn${pending ? " form-submit-btn--pending" : ""}`}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Submit all scores for this group"}
      </button>
    </form>
  );
}
