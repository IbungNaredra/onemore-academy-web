"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  /** Stable id for persisting the pending selection across server redirects. */
  groupId: string;
  assignAction: (formData: FormData) => void | Promise<void>;
  /** Remove one internal_team / fallback_voter from the group (separate from assign form). */
  unassignAction: (formData: FormData) => void | Promise<void>;
  /** Remove all internal_team / fallback_voter assignments on this group (participants unchanged). */
  unassignAllAction: () => void | Promise<void>;
  assignableUsers: AssignableUser[];
  /** Every user ID already assigned to this group (any role). */
  assignedUserIds: string[];
  assignmentChips: AssignmentChip[];
};

/** Prisma enum → short label shown in the picker (admins often search "fallback"). */
export function formatAssignableRoleLabel(role: string): string {
  switch (role) {
    case "FALLBACK_VOTER":
      return "Fallback voter";
    case "INTERNAL_TEAM":
      return "Internal team";
    case "PARTICIPANT":
      return "Participant";
    case "ADMIN":
      return "Admin";
    default:
      return role.replace(/_/g, " ");
  }
}

export function isInternalOrFallbackRole(role: string): boolean {
  return role === "INTERNAL_TEAM" || role === "FALLBACK_VOTER";
}

function countRosterBuckets(chips: AssignmentChip[]) {
  let participant = 0;
  let internalOrFallback = 0;
  for (const c of chips) {
    if (c.role === "PARTICIPANT") participant++;
    else if (isInternalOrFallbackRole(c.role)) internalOrFallback++;
  }
  return { participant, internalOrFallback };
}

type ResolvedRow =
  | { id: string; kind: "pending"; u: AssignableUser }
  | { id: string; kind: "assigned"; a: AssignmentChip };

function countSelectionBuckets(rows: ResolvedRow[]) {
  let participant = 0;
  let internalOrFallback = 0;
  for (const row of rows) {
    const role = row.kind === "pending" ? row.u.role : row.a.role;
    if (role === "PARTICIPANT") participant++;
    else if (isInternalOrFallbackRole(role)) internalOrFallback++;
  }
  return { participant, internalOrFallback };
}

function matchesQuery(u: AssignableUser, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const label = formatAssignableRoleLabel(u.role).toLowerCase();
  return (
    u.email.toLowerCase().includes(s) ||
    u.name.toLowerCase().includes(s) ||
    u.role.toLowerCase().includes(s) ||
    label.includes(s)
  );
}

const layer2AssignStorageKey = (groupId: string) => `oma:layer2-assign:${groupId}`;

export function Layer2VoterAssignForm({
  groupId,
  assignAction,
  unassignAction,
  unassignAllAction,
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
  const hydratedRef = useRef(false);
  /** Avoids clearing sessionStorage on the first passive effect before hydrated `selected` applies. */
  const skipFirstPersistRef = useRef(true);

  const assignableById = useMemo(() => new Map(assignableUsers.map((u) => [u.id, u])), [assignableUsers]);

  const rosterCounts = useMemo(() => countRosterBuckets(assignmentChips), [assignmentChips]);

  /** Survives server `redirect()` after assign; chips resolve from `available` or already-assigned rows. */
  useLayoutEffect(() => {
    if (assignableUsers.length === 0 || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(layer2AssignStorageKey(groupId));
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        const knownIds = new Set([
          ...assignableUsers.map((u) => u.id),
          ...assignmentChips.map((a) => a.userId),
        ]);
        const valid = new Set(ids.filter((id) => knownIds.has(id)));
        setSelected(valid);
      }
    } catch {
      /* ignore */
    }
  }, [groupId, assignableUsers, assignmentChips]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    try {
      if (selected.size === 0) {
        sessionStorage.removeItem(layer2AssignStorageKey(groupId));
      } else {
        sessionStorage.setItem(layer2AssignStorageKey(groupId), JSON.stringify([...selected]));
      }
    } catch {
      /* ignore */
    }
  }, [groupId, selected]);

  const resolvedSelected = useMemo((): ResolvedRow[] => {
    return [...selected]
      .map((id) => {
        const u = available.find((x) => x.id === id);
        if (u) return { id, kind: "pending" as const, u };
        const a = assignmentChips.find((x) => x.userId === id);
        if (a) return { id, kind: "assigned" as const, a };
        const fallback = assignableById.get(id);
        if (fallback) return { id, kind: "pending" as const, u: fallback };
        return null;
      })
      .filter((x): x is ResolvedRow => x != null);
  }, [selected, available, assignmentChips, assignableById]);

  const selectionCounts = useMemo(() => countSelectionBuckets(resolvedSelected), [resolvedSelected]);

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

  const searchInputId = `layer2-voter-search-${groupId}`;
  const listboxId = `layer2-voter-listbox-${groupId}`;

  return (
    <div className="layer2-voter-form">
      <p className="terms-note" style={{ marginBottom: "0.5rem" }}>
        Add <strong>Internal team</strong> or <strong>Fallback voter</strong> users (both appear in the search list).
        Current group voters are listed below; search picks users not yet on this group. Use <strong>×</strong> under
        Selected to assign to drop picks before you submit. Use <strong>Remove</strong> on an internal team or fallback
        voter in the current roster to un-assign them from this group (participant voters are not removed here).
      </p>

      <div className="layer2-voter-current" style={{ marginBottom: "0.65rem" }}>
        <p className="terms-note" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
          Current voters on this group
        </p>
        {assignmentChips.length === 0 ? (
          <p className="terms-note">None yet.</p>
        ) : (
          <div id={`layer2-current-voters-region-${groupId}`}>
            {!showCurrentVoters ? (
              <p className="terms-note layer2-voter-current__summary">
                {assignmentChips.length} voter{assignmentChips.length === 1 ? "" : "s"} assigned —{" "}
                <span className="admin-mono" style={{ fontWeight: 600 }}>
                  Participants: {rosterCounts.participant}
                </span>
                {" · "}
                <span className="admin-mono" style={{ fontWeight: 600 }}>
                  Internal team / Fallback: {rosterCounts.internalOrFallback}
                </span>
                .{" "}
                <button
                  type="button"
                  className="layer2-voter-toggle"
                  onClick={() => setShowCurrentVoters(true)}
                  aria-expanded={false}
                  aria-controls={`layer2-current-voters-region-${groupId}`}
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
                        {a.email} · {a.name} · {formatAssignableRoleLabel(a.role)}
                      </span>
                      {isInternalOrFallbackRole(a.role) ? (
                        <form action={unassignAction} className="layer2-voter-unassign-form">
                          <input type="hidden" name="userId" value={a.userId} />
                          <FormSubmitButton
                            type="submit"
                            className="layer2-voter-chip__remove layer2-voter-unassign-submit"
                            pendingLabel="…"
                            aria-label={`Remove ${a.email} from group`}
                          >
                            Remove
                          </FormSubmitButton>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="layer2-voter-toggle layer2-voter-toggle--after"
                  onClick={() => setShowCurrentVoters(false)}
                  aria-expanded={true}
                  aria-controls={`layer2-current-voters-region-${groupId}`}
                >
                  Show less
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {assignableUsers.length === 0 ? (
        <p className="form-error">
          No users with role Internal team or Fallback voter. Set a user&apos;s role to Fallback voter under{" "}
          <strong>Admin → Users</strong> first.
        </p>
      ) : available.length === 0 ? (
        <div style={{ marginTop: "0.65rem" }}>
          <p className="terms-note">All eligible internal team / fallback voters are already assigned to this group.</p>
          {rosterCounts.internalOrFallback > 0 ? (
            <div className="layer2-voter-assign-actions" style={{ marginTop: "0.5rem" }}>
              <form action={unassignAllAction}>
                <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Removing…">
                  Unassign All
                </FormSubmitButton>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: "0.65rem" }}>
          <form action={assignAction}>
          <label className="layer2-voter-combobox-label" htmlFor={searchInputId}>
            Search and add voters
          </label>
          <div ref={rootRef} className="layer2-voter-combobox">
            <input
              id={searchInputId}
              type="search"
              className="layer2-voter-search"
              placeholder="Search email, name, or type fallback / internal…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              role="combobox"
            />
            {open && (
              <ul id={listboxId} className="layer2-voter-listbox" role="listbox" aria-multiselectable>
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
                            {u.email} · {u.name} · {formatAssignableRoleLabel(u.role)}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {resolvedSelected.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <p className="terms-note" style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
                Selected to assign ({resolvedSelected.length}) —{" "}
                <span className="admin-mono" style={{ fontWeight: 600 }}>
                  Participants: {selectionCounts.participant}
                </span>
                {" · "}
                <span className="admin-mono" style={{ fontWeight: 600 }}>
                  Internal team / Fallback: {selectionCounts.internalOrFallback}
                </span>
              </p>
              <ul className="layer2-voter-chips" aria-label="Users to assign on submit">
                {resolvedSelected.map((row) =>
                  row.kind === "pending" ? (
                    <li key={row.id} className="layer2-voter-chip">
                      <span className="layer2-voter-chip__text">
                        {row.u.email} · {row.u.name} · {formatAssignableRoleLabel(row.u.role)}
                      </span>
                      <button
                        type="button"
                        className="layer2-voter-chip__remove"
                        onClick={() => toggle(row.id)}
                        aria-label={`Remove ${row.u.email}`}
                      >
                        ×
                      </button>
                    </li>
                  ) : (
                    <li key={row.id} className="layer2-voter-chip layer2-voter-chip--readonly">
                      <span className="layer2-voter-chip__text">
                        {row.a.email} · {row.a.name} · {formatAssignableRoleLabel(row.a.role)}
                        <span className="terms-note" style={{ marginLeft: "0.35rem", fontWeight: 400 }}>
                          (assigned)
                        </span>
                      </span>
                      <button
                        type="button"
                        className="layer2-voter-chip__remove"
                        onClick={() => toggle(row.id)}
                        aria-label={`Remove ${row.a.email} from selection`}
                      >
                        ×
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="assignUserId" value={id} />
          ))}

          <div className="layer2-voter-assign-actions">
            <FormSubmitButton
              type="submit"
              className="cta-btn"
              pendingLabel="Saving…"
              disabled={selected.size === 0}
            >
              Assign selected voters
            </FormSubmitButton>
            <FormSubmitButton
              type="submit"
              formAction={unassignAllAction}
              className="admin-table-btn"
              pendingLabel="Removing…"
              disabled={rosterCounts.internalOrFallback === 0}
            >
              Unassign All
            </FormSubmitButton>
          </div>
        </form>
        </div>
      )}
    </div>
  );
}
