import Link from "next/link";
import { ContentType } from "@prisma/client";
import { submitVote } from "@/app/judge/actions";
import type { JudgeQueueResult } from "@/lib/judge-queue";
import type { JudgeVoteReturnPath } from "@/lib/judge-return-path";

function labelContentType(ct: ContentType) {
  return ct === ContentType.MINI_GAMES ? "Mini Games" : "Interactive Content";
}

type OkQueue = Extract<JudgeQueueResult, { ok: true }>;

export function JudgeQueueView({
  q,
  returnPath,
  showContentTypeInCards,
  completeMessage,
}: {
  q: OkQueue;
  returnPath: JudgeVoteReturnPath;
  showContentTypeInCards: boolean;
  completeMessage?: string;
}) {
  const defaultComplete =
    "You have scored every submission in this lane for this session. Thank you — admins can still reset a vote if a correction is needed (PRD §8.6).";

  return (
    <>
      <p className="judge-progress">
        Progress: <strong>{q.voted}</strong> / {q.total} scored
      </p>

      {q.total > 0 && q.voted === q.total ? (
        <div className="judge-complete-banner" role="status">
          <strong>Lane complete.</strong> {completeMessage ?? defaultComplete}
        </div>
      ) : null}

      {q.total === 0 ? (
        <p className="judge-empty">
          Nothing in this lane yet. An admin must create brackets for the batch, link submissions (matching this
          content type), and assign you to those brackets — see{" "}
          <Link href="/admin/batches">Admin → Batches</Link>.
        </p>
      ) : (
        <ul className="judge-queue">
          {q.rows.map((row) => (
            <li key={row.submissionId} className="judge-card">
              <div className="judge-card-head">
                <span className="judge-creator">{row.creatorName}</span>
                <span className="judge-meta">
                  {row.batchLabel}
                  {showContentTypeInCards ? ` · ${labelContentType(row.contentType)}` : null}
                </span>
              </div>
              <a href={row.contentUrl} className="judge-ugc-link" target="_blank" rel="noopener noreferrer">
                Open UGC
              </a>
              {row.locked ? (
                <p className="judge-locked">Judging is locked for this batch.</p>
              ) : (
                <div className="judge-vote-row">
                  <span className="judge-current">
                    {row.currentScore === null
                      ? "Neutral (+0)"
                      : row.currentScore === 1
                        ? "Voted (+1)"
                        : "Neutral (0)"}
                  </span>
                  <div className="judge-vote-forms">
                    <form action={submitVote} className="judge-vote-form">
                      <input type="hidden" name="submissionId" value={row.submissionId} />
                      <input type="hidden" name="score" value="1" />
                      <input type="hidden" name="returnTo" value={returnPath} />
                      <button className="btn-judge-good" type="submit">
                        Vote
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
