"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

export type AssignableUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type AssignmentChip = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

type Props = {
  assignAction: (formData: FormData) => void | Promise<void>;
  assignableUsers: AssignableUser[];
  /** Every user ID already assigned to this group (any role). */
  assignedUserIds: string[];
  assignmentChips: AssignmentChip[];
};

function matchesQuery(u: AssignableUser, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    u.email.toLowerCase().includes(s) ||
    u.name.toLowerCase().includes(s) ||
    u.role.toLowerCase().includes(s)
  );
}

export function Layer2VoterAssignForm({
  assignAction,
  assignableUsers,
  assignedUserIds,
  assignmentChips,
}: Props) {
  const assignedSet = useMemo(() => new Set(assignedUserIds), [assignedUserIds]);
  const available = useMemo(
    () => assignableUsers.filter((u) => !assignedSet.has(u.id)),
    [assignableUsers, assignedSet],
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Full chip list is long; keep collapsed by default to save vertical space. */
  const [showCurrentVoters, setShowCurrentVoters] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => available.filter((u) => matchesQuery(u, query)), [available, query]);

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

  const selectedUsers = useMemo(
    () => available.filter((u) => selected.has(u.id)),
    [available, selected],
  );

  return (
    <form action={assignAction} className="layer2-voter-form">
      <p className="terms-note" style={{ marginBottom: "0.5rem" }}>
        Add internal team / fallback voters. Current group voters are listed below; search picks users not yet on this
        group.
      </p>

      <div className="layer2-voter-current" style={{ marginBottom: "0.65rem" }}>
        <p className="terms-note" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
          Current voters on this group
        </p>
        {assignmentChips.length === 0 ? (
          <p className="terms-note">None yet.</p>
        ) : (
          <div id="layer2-current-voters-region">
            {!showCurrentVoters ? (
              <p className="terms-note layer2-voter-current__summary">
                {assignmentChips.length} voter{assignmentChips.length === 1 ? "" : "s"} assigned.{" "}
                <button
                  type="button"
                  className="layer2-voter-toggle"
                  onClick={() => setShowCurrentVoters(true)}
                  aria-expanded={false}
                  aria-controls="layer2-current-voters-region"
                >
                  Show more
                </button>
              </p>
            ) : (
              <>
                <ul className="layer2-voter-chips" aria-label="Current group voters">
                  {assignmentChips.map((a) => (
                    <li key={a.userId} className="layer2-voter-chip layer2-voter-chip--readonly">
                      <span className="layer2-voter-chip__text">
                        {a.email} · {a.name} · {a.role}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="layer2-voter-toggle layer2-voter-toggle--after"
                  onClick={() => setShowCurrentVoters(false)}
                  aria-expanded={true}
                  aria-controls="layer2-current-voters-region"
                >
                  Show less
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {assignableUsers.length === 0 ? (
        <p className="form-error">No users with role internal_team or fallback_voter.</p>
      ) : available.length === 0 ? (
        <p className="terms-note">All eligible internal team / fallback voters are already assigned to this group.</p>
      ) : (
        <>
          <label className="layer2-voter-combobox-label" htmlFor="layer2-voter-search">
            Search and add voters
          </label>
          <div ref={rootRef} className="layer2-voter-combobox">
            <input
              id="layer2-voter-search"
              type="search"
              className="layer2-voter-search"
              placeholder="Search by email, name, or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              autoComplete="off"
              aria-expanded={open}
              aria-controls="layer2-voter-listbox"
              aria-autocomplete="list"
              role="combobox"
            />
            {open && (
              <ul
                id="layer2-voter-listbox"
                className="layer2-voter-listbox"
                role="listbox"
                aria-multiselectable
              >
                {filtered.length === 0 ? (
                  <li className="layer2-voter-listbox__empty">No matches.</li>
                ) : (
                  filtered.map((u) => {
                    const isOn = selected.has(u.id);
                    return (
                      <li key={u.id} role="option" aria-selected={isOn}>
                        <button
                          type="button"
                          className={`layer2-voter-option${isOn ? " layer2-voter-option--on" : ""}`}
                          onClick={() => toggle(u.id)}
                        >
                          <span className="layer2-voter-option__check" aria-hidden>
                            {isOn ? "☑" : "☐"}
                          </span>
                          <span>
                            {u.email} · {u.name} · {u.role}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <p className="terms-note" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
                Selected to assign
              </p>
              <ul className="layer2-voter-chips" aria-label="Users to assign on submit">
                {selectedUsers.map((u) => (
                  <li key={u.id} className="layer2-voter-chip">
                    <span className="layer2-voter-chip__text">
                      {u.email} · {u.name} · {u.role}
                    </span>
                    <button
                      type="button"
                      className="layer2-voter-chip__remove"
                      onClick={() => toggle(u.id)}
                      aria-label={`Remove ${u.email}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="assignUserId" value={id} />
          ))}

          <FormSubmitButton
            type="submit"
            className="cta-btn"
            style={{ marginTop: "0.65rem" }}
            pendingLabel="Saving…"
            disabled={selected.size === 0}
          >
            Assign selected voters
          </FormSubmitButton>
        </>
      )}
    </form>
  );
}
