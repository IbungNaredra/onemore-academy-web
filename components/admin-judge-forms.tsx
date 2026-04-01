"use client";

import { useState, useTransition } from "react";
import { createJudge, resetJudgePassword } from "@/app/admin/actions";

export function AddJudgeForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="admin-form-card"
      action={(fd) => {
        setMessage(null);
        startTransition(async () => {
          try {
            await createJudge(fd);
            setMessage("Judge created.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Could not create judge");
          }
        });
      }}
    >
      <h3 className="admin-form-title">Add judge</h3>
      <div className="form-field">
        <label htmlFor="j-email">Email</label>
        <input id="j-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="form-field">
        <label htmlFor="j-name">Name (optional)</label>
        <input id="j-name" name="name" type="text" />
      </div>
      <div className="form-field">
        <label htmlFor="j-pass">Temporary password (min 8 chars)</label>
        <input id="j-pass" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create judge"}
      </button>
      {message ? (
        <p className={message.startsWith("Judge") ? "form-success" : "form-error"}>{message}</p>
      ) : null}
    </form>
  );
}

export function ResetJudgePasswordForm({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="admin-inline-form"
      action={(fd) => {
        setMessage(null);
        startTransition(async () => {
          try {
            await resetJudgePassword(fd);
            setMessage("Updated");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Failed");
          }
        });
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="password" name="password" placeholder="New password" minLength={8} required />
      <button className="btn-ghost btn-small" type="submit" disabled={pending}>
        {pending ? "…" : "Set password"}
      </button>
      {message ? <span className="form-success-inline">{message}</span> : null}
    </form>
  );
}
