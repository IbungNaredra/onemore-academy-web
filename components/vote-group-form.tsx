"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitGroupRatings } from "@/app/actions/vote";
import { useSnackbar } from "@/components/snackbar-context";

type Row = { id: string; url: string; creator: string };

export function VoteGroupForm({ groupId, rows }: { groupId: string; rows: Row[] }) {
  const router = useRouter();
  const { showError, showSuccess } = useSnackbar();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, 3])),
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await submitGroupRatings(groupId, scores);
      if (res.error) {
        showError(res.error);
        return;
      }
      showSuccess("Scores saved.");
      router.push("/vote");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      {rows.map((r) => (
        <div key={r.id} style={{ marginBottom: "1rem" }}>
          <p>
            <strong>{r.creator}</strong> —{" "}
            <a href={r.url} target="_blank" rel="noreferrer">
              open link
            </a>
          </p>
          <label>
            Score 1–5
            <input
              className="admin-input"
              type="number"
              min={1}
              max={5}
              step={1}
              value={scores[r.id] ?? 3}
              onChange={(e) => setScores((s) => ({ ...s, [r.id]: Number(e.target.value) }))}
            />
          </label>
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
