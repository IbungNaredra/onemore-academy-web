"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitGroupRatings } from "@/app/actions/vote";

type Row = { id: string; url: string; creator: string };

export function VoteGroupForm({ groupId, rows }: { groupId: string; rows: Row[] }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, 3])),
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await submitGroupRatings(groupId, scores);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    router.push("/vote");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      {msg && <p className="terms-note">{msg}</p>}
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
      <button type="submit" className="cta-btn">
        Submit all scores for this group
      </button>
    </form>
  );
}
