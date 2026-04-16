"use client";

import { FormSubmitButton } from "@/components/form-submit-button";
import { adminResetBatchForRetest } from "@/app/actions/admin";

type Props = {
  batchId: string;
  batchLabel: string;
};

export function AdminResetBatchForRetestForm({ batchId, batchLabel }: Props) {
  return (
    <form
      action={adminResetBatchForRetest.bind(null, batchId)}
      className="admin-toolbar-form"
      onSubmit={(e) => {
        const ok = window.confirm(
          [
            `Reset batch "${batchLabel}" for retest?`,
            "",
            "Submissions (UGC) are kept. This permanently removes for THIS BATCH ONLY:",
            "• All ratings, content groups, and voter assignments",
            "• Published winners and voter eligibility rows",
            "",
            "Scores and finalist flags on submissions are cleared. Batch flags are reset so you can use OPEN → VOTING again to rebuild groups.",
            "Votes and groups cannot be recovered.",
          ].join("\n"),
        );
        if (!ok) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="confirm" value="RESET_BATCH_FOR_RETEST" />
      <FormSubmitButton
        type="submit"
        className="admin-table-btn admin-btn-danger"
        pendingLabel="Resetting…"
      >
        Reset batch for retest
      </FormSubmitButton>
    </form>
  );
}
