import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireParticipantSubmit } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { BatchStatus, SubmissionStatus } from "@prisma/client";
import { updateSubmission } from "@/app/actions/submit";
import { FormSubmitButton } from "@/components/form-submit-button";
import { buildToastUrl } from "@/lib/snackbar-url";

export const dynamic = "force-dynamic";

export default async function EditSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const session = await requireParticipantSubmit();

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { batch: true },
  });

  if (!sub || sub.userId !== session.user.id) notFound();

  if (sub.status === SubmissionStatus.DISQUALIFIED) {
    redirect(buildToastUrl("/submit", "error", "Disqualified submissions cannot be edited."));
  }
  if (sub.batch.status !== BatchStatus.OPEN) {
    redirect(buildToastUrl("/submit", "error", "This batch is no longer open for edits."));
  }

  const categoryLocked = Boolean(
    await prisma.groupSubmission.findFirst({ where: { submissionId: sub.id }, select: { groupId: true } }),
  );

  return (
    <main className="panel">
      <h2 className="section-h2">Edit submission</h2>
      <p className="hero-lead">
        <strong>{sub.batch.label}</strong> — you can change the title and link while this batch is open.
        {categoryLocked ? " Category is fixed because this entry is already in a voting group." : null}
      </p>

      <form
        action={updateSubmission.bind(null, submissionId)}
        className="card submit-ugc-form"
        style={{ maxWidth: 520 }}
      >
        <label>
          Category
          {categoryLocked ? (
            <>
              <input type="hidden" name="category" value={sub.category} />
              <p className="terms-note" style={{ margin: "0.35rem 0 0" }}>
                {sub.category === "MINI_GAMES" ? "Mini Games" : "Real Life + Prompt"} (locked)
              </p>
            </>
          ) : (
            <select className="admin-input" name="category" required defaultValue={sub.category}>
              <option value="MINI_GAMES">Mini Games</option>
              <option value="REAL_LIFE_PROMPT">Real Life + Prompt</option>
            </select>
          )}
        </label>
        <label>
          Content title
          <input
            className="admin-input"
            name="contentTitle"
            type="text"
            required
            maxLength={200}
            placeholder="Shown when voting and on the leaderboard"
            autoComplete="off"
            defaultValue={sub.contentTitle}
          />
        </label>
        <label>
          Content URL (https)
          <input
            className="admin-input"
            name="contentUrl"
            type="url"
            placeholder="https://..."
            required
            defaultValue={sub.contentUrl}
          />
        </label>
        <div className="submit-edit-actions">
          <FormSubmitButton type="submit" className="cta-btn" pendingLabel="Saving…">
            Save changes
          </FormSubmitButton>
          <Link href="/submit" className="nav-link">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
