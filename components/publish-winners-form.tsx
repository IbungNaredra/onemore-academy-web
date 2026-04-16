"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

export type PickableSubmission = {
  id: string;
  submitterName: string;
  email: string;
  categoryLabel: string;
  scoreLabel: string;
};

type Props = {
  /** For stable `id` / `htmlFor` when multiple batches on one page. */
  batchId: string;
  publishAction: (formData: FormData) => void | Promise<void>;
  submissions: PickableSubmission[];
  /** Current published winner submission ids (used when session storage is empty). */
  publishedSubmissionIds?: string[];
};

function matchesQuery(s: PickableSubmission, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    s.id.toLowerCase().includes(t) ||
    s.submitterName.toLowerCase().includes(t) ||
    s.email.toLowerCase().includes(t) ||
    s.categoryLabel.toLowerCase().includes(t) ||
    s.scoreLabel.toLowerCase().includes(t)
  );
}

const storageKey = (batchId: string) => `oma:publish-winners:${batchId}`;

export function PublishWinnersForm({
  batchId,
  publishAction,
  submissions,
  publishedSubmissionIds = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  /** Avoids `removeItem` on the first passive effect while `selected` is still default []. */
  const skipFirstPersistRef = useRef(true);

  const byId = useMemo(() => new Map(submissions.map((s) => [s.id, s])), [submissions]);

  /** Survives server `redirect()` after Publish / Un-publish so admins still see what they picked. */
  useLayoutEffect(() => {
    if (submissions.length === 0 || hydratedRef.current) return;
    hydratedRef.current = true;
    const idSet = new Set(submissions.map((s) => s.id));
    try {
      const raw = sessionStorage.getItem(storageKey(batchId));
      let ids: string[] = [];
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
      }
      if (ids.length === 0 && publishedSubmissionIds.length > 0) {
        ids = publishedSubmissionIds;
      }
      const valid = new Set(ids.filter((id) => idSet.has(id)));
      setSelected(valid);
    } catch {
      /* ignore */
    }
  }, [batchId, submissions, publishedSubmissionIds]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    try {
      if (selected.size === 0) {
        sessionStorage.removeItem(storageKey(batchId));
      } else {
        sessionStorage.setItem(storageKey(batchId), JSON.stringify([...selected]));
      }
    } catch {
      /* ignore */
    }
  }, [batchId, selected]);

  const filtered = useMemo(
    () => submissions.filter((s) => matchesQuery(s, query)),
    [submissions, query],
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = useMemo(() => {
    return [...selected].map((id) => byId.get(id)).filter(Boolean) as PickableSubmission[];
  }, [selected, byId]);

  if (submissions.length === 0) {
    return (
      <p className="terms-note">No active submissions in this batch.</p>
    );
  }

  return (
    <form action={publishAction} className="layer2-voter-form">
      <p className="terms-note" style={{ marginBottom: "0.5rem" }}>
        Search and select one or more submissions to publish as winners for this batch.
      </p>

      <label className="layer2-voter-combobox-label" htmlFor={`publish-winners-search-${batchId}`}>
        Search submissions
      </label>
      <div ref={rootRef} className="layer2-voter-combobox">
        <input
          id={`publish-winners-search-${batchId}`}
          type="search"
          className="layer2-voter-search"
          placeholder="Search by ID, name, email, category, or score…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`publish-winners-listbox-${batchId}`}
          role="combobox"
        />
        {open && (
          <ul
            id={`publish-winners-listbox-${batchId}`}
            className="layer2-voter-listbox"
            role="listbox"
            aria-multiselectable
          >
            {filtered.length === 0 ? (
              <li className="layer2-voter-listbox__empty">No matches.</li>
            ) : (
              filtered.map((s) => {
                const isOn = selected.has(s.id);
                return (
                  <li key={s.id} role="option" aria-selected={isOn}>
                    <button
                      type="button"
                      className={`layer2-voter-option${isOn ? " layer2-voter-option--on" : ""}`}
                      onClick={() => toggle(s.id)}
                    >
                      <span className="layer2-voter-option__check" aria-hidden>
                        {isOn ? "☑" : "☐"}
                      </span>
                      <span>
                        <code style={{ fontSize: "0.72rem" }}>{s.id}</code> · {s.submitterName} · {s.email} ·{" "}
                        {s.categoryLabel} · {s.scoreLabel}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <p className="terms-note" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
            Selected ({selectedRows.length})
          </p>
          <ul className="layer2-voter-chips" aria-label="Submissions to publish">
            {selectedRows.map((s) => (
              <li key={s.id} className="layer2-voter-chip">
                <span className="layer2-voter-chip__text">
                  {s.submitterName} · {s.categoryLabel} · {s.scoreLabel}
                </span>
                <button
                  type="button"
                  className="layer2-voter-chip__remove"
                  onClick={() => toggle(s.id)}
                  aria-label={`Remove ${s.submitterName}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <FormSubmitButton
        type="submit"
        className="cta-btn"
        style={{ marginTop: "0.65rem" }}
        pendingLabel="Publishing…"
        disabled={selected.size === 0}
      >
        Publish
      </FormSubmitButton>
    </form>
  );
}
