"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { adminDisqualify } from "@/app/actions/admin";
import { buildToastUrl } from "@/lib/snackbar-url";
import { submissionDisplayTitle } from "@/lib/submission-display";
import { CopyContentIdButton } from "@/components/copy-content-id-button";

export type SubmissionRow = Prisma.SubmissionGetPayload<{
  include: { user: true; batch: true };
}>;

type Props = {
  submissions: SubmissionRow[];
};

export function AdminSubmissionsTable({ submissions }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closeDialog = () => {
    dialogRef.current?.close();
    setOpenId(null);
    setReason("");
    setError(null);
  };

  useEffect(() => {
    if (!openId) return;
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    queueMicrotask(() => reasonRef.current?.focus());
  }, [openId]);

  const openFor = (id: string) => {
    setError(null);
    setReason("");
    setOpenId(id);
  };

  const handleDisqualify = () => {
    if (!openId) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please enter a reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await adminDisqualify(openId, trimmed);
        closeDialog();
        router.push(buildToastUrl("/admin/submissions", "success", "Submission disqualified."));
      } catch {
        setError("Could not disqualify. Try again or refresh the page.");
      }
    });
  };

  return (
    <>
      <table className="admin-table admin-submissions-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>User</th>
            <th>Category</th>
            <th>Content title</th>
            <th>URL</th>
            <th>Content id</th>
            <th>Status</th>
            <th>Disqualify</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td>{s.batch.label}</td>
              <td>{s.user.email}</td>
              <td>{s.category}</td>
              <td>{submissionDisplayTitle(s.contentTitle, s.user.name)}</td>
              <td>
                <a href={s.contentUrl} target="_blank" rel="noreferrer">
                  link
                </a>
              </td>
              <td>
                <CopyContentIdButton id={s.id} />
              </td>
              <td>{s.status}</td>
              <td>
                <button
                  type="button"
                  className="admin-table-btn"
                  disabled={s.status === "DISQUALIFIED"}
                  onClick={() => openFor(s.id)}
                >
                  DQ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dialog
        ref={dialogRef}
        className="admin-disqualify-dialog"
        aria-labelledby="admin-dq-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDialog();
        }}
        onClose={() => {
          setOpenId(null);
          setReason("");
          setError(null);
        }}
      >
        <h3 id="admin-dq-dialog-title" className="admin-disqualify-dialog__title">
          Disqualify submission
        </h3>
        <p className="admin-disqualify-dialog__hint">Provide a reason for the disqualification.</p>
        <label className="admin-disqualify-dialog__label">
          Reason
          <textarea
            ref={reasonRef}
            className="admin-input admin-disqualify-dialog__textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            disabled={pending}
            placeholder="Reason"
          />
        </label>
        {error ? <p className="admin-disqualify-dialog__error">{error}</p> : null}
        <div className="admin-disqualify-dialog__actions">
          <button type="button" className="admin-table-btn" onClick={closeDialog} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-table-btn"
            onClick={handleDisqualify}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Disqualifying…" : "Disqualify"}
          </button>
        </div>
      </dialog>
    </>
  );
}
