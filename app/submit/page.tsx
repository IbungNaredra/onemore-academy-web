import Link from "next/link";
import { requireParticipantSubmit } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { BatchStatus } from "@prisma/client";
import { resolveSubmissionBatch } from "@/lib/submission-batch";
import { createSubmission, deleteSubmission } from "@/app/actions/submit";
import { FormSubmitButton } from "@/components/form-submit-button";

export const dynamic = "force-dynamic";

const tzShanghai = "Asia/Shanghai";

function formatInstant(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tzShanghai,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function SubmitPage() {
  const session = await requireParticipantSubmit();

  const submissionBatch = await resolveSubmissionBatch();

  const mine = await prisma.submission.findMany({
    where: { userId: session.user.id },
    include: { batch: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="panel">
      <h2 className="section-h2">Submit UGC</h2>
      <p className="hero-lead">Allowed only during each batch’s submission window (set by admin). HTTPS URLs only.</p>

      {!submissionBatch ? (
        <p className="terms-note">
          No batch is in its submission window right now. Submissions are accepted when a batch is OPEN and the current
          time is between that batch’s open time and voting start (see admin batch schedule).
        </p>
      ) : (
        <form action={createSubmission} className="card" style={{ maxWidth: 520 }}>
          <p className="terms-note" style={{ marginBottom: "1rem" }}>
            Your entry will be submitted to <strong>{submissionBatch.label}</strong>. Submission window (China time,{" "}
            {tzShanghai}): {formatInstant(submissionBatch.openAt)} → {formatInstant(submissionBatch.votingAt)}.
          </p>
          <label>
            Category
            <select className="admin-input" name="category" required>
              <option value="MINI_GAMES">Mini Games</option>
              <option value="REAL_LIFE_PROMPT">Real Life + Prompt</option>
            </select>
          </label>
          <label>
            onemore content URL (https)
            <input className="admin-input" name="contentUrl" type="url" placeholder="https://..." required />
          </label>
          <FormSubmitButton type="submit" className="cta-btn" pendingLabel="Submitting…">
            Submit
          </FormSubmitButton>
        </form>
      )}

      <h3 className="card-title" style={{ marginTop: "2rem" }}>
        <span className="title-icon">◇</span> Your submissions
      </h3>
      <ul className="terms-list compact">
        {mine.map((s) => (
          <li key={s.id}>
            <strong>{s.batch.label}</strong> · {s.category.replace("_", " ")} ·{" "}
            <a href={s.contentUrl} target="_blank" rel="noreferrer">
              link
            </a>
            {s.batch.status === BatchStatus.OPEN && (
              <form action={deleteSubmission.bind(null, s.id)} style={{ display: "inline", marginLeft: 8 }}>
                <FormSubmitButton
                  type="submit"
                  className="week-btn"
                  style={{ fontSize: "0.75rem" }}
                  pendingLabel="Deleting…"
                >
                  Delete
                </FormSubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
      <p className="jump-link">
        <Link href="/vote">Back to vote queue</Link>
      </p>
    </main>
  );
}
