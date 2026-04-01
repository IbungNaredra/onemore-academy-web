import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/sign-out-button";
import {
  assignJudgeToBracket,
  autoLinkBatchSubmissions,
  createBracket,
  createPublishedWinner,
  deleteBracket,
  deletePublishedWinner,
  linkSubmissionToBracket,
  removeJudgeAssignment,
  setBatchJudgingLock,
  updateBatchMultiRoundSettings,
  updateBatchState,
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { BatchPublicState, ContentType, Role } from "@prisma/client";

function labelContentType(ct: ContentType) {
  return ct === ContentType.MINI_GAMES ? "Mini Games" : "Interactive Content";
}

export default async function AdminBatchesPage() {
  await requireAdmin();

  const batches = await prisma.programBatch.findMany({
    orderBy: { submissionStart: "asc" },
    include: {
      brackets: {
        orderBy: [{ contentType: "asc" }, { sortOrder: "asc" }],
        include: {
          _count: { select: { submissions: true, assignments: true } },
          assignments: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
        },
      },
      winners: { include: { submission: true } },
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { disqualified: false },
    orderBy: { creatorName: "asc" },
    select: {
      id: true,
      creatorName: true,
      contentUrl: true,
      contentType: true,
      programBatchId: true,
      bracketId: true,
    },
  });

  const judges = await prisma.user.findMany({
    where: { role: Role.JUDGE },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  return (
    <main className="panel-page admin-wide">
      <AdminNav />
      <h2>Batches &amp; brackets</h2>
      <p className="admin-lead">
        Set each batch&apos;s public state, create bracket pools per content type, and publish winners (links
        the public leaderboard to the database).
      </p>

      {batches.map((batch) => {
        const batchSubs = submissions.filter((s) => s.programBatchId === batch.id);
        const unlinkedCount = batchSubs.filter((s) => !s.bracketId).length;
        const bracketContentTypes = new Set(batch.brackets.map((b) => b.contentType));
        const strandedCount = batchSubs.filter(
          (s) => !s.bracketId && !bracketContentTypes.has(s.contentType),
        ).length;
        return (
          <article key={batch.id} className="admin-batch-card">
            <header className="admin-batch-header">
              <div>
                <h3>{batch.label}</h3>
                <code className="admin-mono">{batch.slug}</code>
              </div>
              <Link className="admin-results-link" href={`/admin/batches/${batch.id}/results`}>
                Results &amp; scores
              </Link>
            </header>

            <section className="admin-batch-section">
              <h4>Public state</h4>
              <form action={updateBatchState} className="admin-row-form">
                <input type="hidden" name="batchId" value={batch.id} />
                <select name="publicState" defaultValue={batch.publicState} className="admin-select">
                  {Object.values(BatchPublicState).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="btn-primary btn-small" type="submit">
                  Save state
                </button>
              </form>
            </section>

            <section className="admin-batch-section">
              <h4>Judging lock</h4>
              <p className="admin-hint">
                When locked, judges cannot change scores for submissions in this batch&apos;s brackets.
              </p>
              <p className="admin-mono">
                {batch.judgingLockedAt
                  ? `Locked at ${batch.judgingLockedAt.toISOString()}`
                  : "Unlocked"}
              </p>
              <form action={setBatchJudgingLock} className="admin-row-form">
                <input type="hidden" name="batchId" value={batch.id} />
                <input type="hidden" name="lock" value={batch.judgingLockedAt ? "0" : "1"} />
                <button className="btn-ghost btn-small" type="submit">
                  {batch.judgingLockedAt ? "Unlock judging" : "Lock judging"}
                </button>
              </form>
            </section>

            <section className="admin-batch-section">
              <h4>Multi-round judging (optional)</h4>
              <p className="admin-hint">
                Enable per <strong>content type</strong> (e.g. Mini Games = many entries → multi-round; Interactive
                = smaller pool → single pool). Only the <strong>active</strong> round for a type appears in the judge
                queue when that type is on. <strong>Lock judging</strong> applies cuts from the JSON arrays (e.g.{" "}
                <code>[4, 2]</code>). For a <strong>single</strong> judging round on one type, use one element, e.g.{" "}
                <code>[2]</code> (cut to 2 finalists in one lock). Scores carry over; ties can open a{" "}
                <strong>runoff</strong>.
              </p>
              <form
                action={updateBatchMultiRoundSettings}
                className="admin-stack-form"
                key={`mr-${batch.id}-${batch.multiRoundMiniGames ? 1 : 0}-${batch.multiRoundInteractive ? 1 : 0}-${batch.roundCutsMini ?? ""}-${batch.roundCutsInteractive ?? ""}-${batch.updatedAt.toISOString()}`}
              >
                <input type="hidden" name="batchId" value={batch.id} />
                <div className="form-field">
                  <label htmlFor={`mr-mini-${batch.id}`}>Mini Games — multi-round</label>
                  <select
                    id={`mr-mini-${batch.id}`}
                    name="multiRoundMini"
                    className="admin-select"
                    defaultValue={batch.multiRoundMiniGames ? "1" : "0"}
                  >
                    <option value="0">Off (classic pool)</option>
                    <option value="1">On (cuts + runoffs on lock)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor={`mr-ic-${batch.id}`}>Interactive — multi-round</label>
                  <select
                    id={`mr-ic-${batch.id}`}
                    name="multiRoundInteractive"
                    className="admin-select"
                    defaultValue={batch.multiRoundInteractive ? "1" : "0"}
                  >
                    <option value="0">Off (classic pool)</option>
                    <option value="1">On (cuts + runoffs on lock)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor={`cuts-mini-${batch.id}`}>Round cuts — Mini Games (JSON int array)</label>
                  <input
                    id={`cuts-mini-${batch.id}`}
                    name="roundCutsMini"
                    className="admin-select-full"
                    defaultValue={batch.roundCutsMini ?? "[4,2]"}
                    placeholder="[4,2]"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`cuts-ic-${batch.id}`}>Round cuts — Interactive (JSON int array)</label>
                  <input
                    id={`cuts-ic-${batch.id}`}
                    name="roundCutsInteractive"
                    className="admin-select-full"
                    defaultValue={batch.roundCutsInteractive ?? "[4,2]"}
                    placeholder="[4,2]"
                  />
                </div>
                <button className="btn-ghost btn-small" type="submit">
                  Save multi-round settings
                </button>
              </form>
            </section>

            <section className="admin-batch-section">
              <h4>Brackets</h4>
              <p className="admin-hint">One bracket = one judge pool for a content type in this batch.</p>
              <ul className="admin-bracket-list">
                {batch.brackets.map((br) => (
                  <li key={br.id}>
                    <div className="admin-bracket-block">
                      <div className="admin-bracket-title-row">
                        <span>
                          {labelContentType(br.contentType)} · order {br.sortOrder} · {br._count.submissions}{" "}
                          submissions · {br._count.assignments} judge(s)
                        </span>
                        <form action={deleteBracket} className="admin-inline">
                          <input type="hidden" name="bracketId" value={br.id} />
                          <button type="submit" className="btn-danger-ghost btn-small">
                            Remove bracket
                          </button>
                        </form>
                      </div>
                      {br.assignments.length > 0 ? (
                        <ul className="admin-assignment-list">
                          {br.assignments.map((a) => (
                            <li key={a.id}>
                              <span>{a.user.name ?? a.user.email}</span>
                              <form action={removeJudgeAssignment} className="admin-inline">
                                <input type="hidden" name="assignmentId" value={a.id} />
                                <button type="submit" className="btn-danger-ghost btn-small">
                                  Unassign
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-hint admin-hint-tight">No judges assigned.</p>
                      )}
                      {judges.length > 0 ? (
                        <form action={assignJudgeToBracket} className="admin-row-form admin-row-form-wrap">
                          <input type="hidden" name="bracketId" value={br.id} />
                          <select name="userId" className="admin-select" required aria-label="Judge">
                            <option value="">— Assign judge —</option>
                            {judges.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.name ?? j.email}
                              </option>
                            ))}
                          </select>
                          <button className="btn-ghost btn-small" type="submit">
                            Add judge
                          </button>
                        </form>
                      ) : (
                        <p className="admin-hint admin-hint-tight">Create judge accounts under Judges first.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <form action={createBracket} className="admin-row-form">
                <input type="hidden" name="batchId" value={batch.id} />
                <select name="contentType" className="admin-select" required defaultValue={ContentType.MINI_GAMES}>
                  <option value={ContentType.MINI_GAMES}>Mini Games</option>
                  <option value={ContentType.INTERACTIVE_CONTENT}>Interactive Content</option>
                </select>
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={0}
                  className="admin-input-narrow"
                  aria-label="Sort order"
                />
                <button className="btn-ghost btn-small" type="submit">
                  Add bracket
                </button>
              </form>
            </section>

            {batch.brackets.length > 0 && batchSubs.length > 0 ? (
              <section className="admin-batch-section">
                <h4>Link submissions → brackets</h4>
                <p className="admin-hint">
                  Judges only see submissions that are linked to a bracket (same batch, same content type).
                  After syncing many rows from the sheet, use <strong>Auto-link all</strong> instead of linking
                  one-by-one.
                </p>
                <p className="admin-mono admin-hint-tight">
                  {batchSubs.length} submission{batchSubs.length === 1 ? "" : "s"} in this batch ·{" "}
                  {unlinkedCount} not linked
                  {strandedCount > 0
                    ? ` · ${strandedCount} need a bracket for their content type (create it above)`
                    : ""}
                </p>
                <form action={autoLinkBatchSubmissions} className="admin-row-form admin-row-form-wrap">
                  <input type="hidden" name="batchId" value={batch.id} />
                  <button className="btn-primary btn-small" type="submit">
                    Auto-link all submissions
                  </button>
                </form>
                <p className="admin-hint admin-hint-tight">
                  Assigns each row to the bracket that matches Mini Games vs Interactive. If you have multiple
                  brackets for the same type, submissions are spread round-robin across them (PRD §6).
                </p>

                <h5>Link one submission (override)</h5>
                <form action={linkSubmissionToBracket} className="admin-stack-form">
                  <div className="form-field">
                    <label htmlFor={`link-sub-${batch.id}`}>Submission</label>
                    <select
                      id={`link-sub-${batch.id}`}
                      name="submissionId"
                      required
                      className="admin-select-full"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        — Select —
                      </option>
                      {batchSubs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.creatorName} · {labelContentType(s.contentType)}
                          {s.bracketId ? " · linked" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor={`link-br-${batch.id}`}>Bracket</label>
                    <select id={`link-br-${batch.id}`} name="bracketId" required className="admin-select-full">
                      <option value="">— Select —</option>
                      {batch.brackets.map((br) => (
                        <option key={br.id} value={br.id}>
                          {labelContentType(br.contentType)} · order {br.sortOrder}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-ghost btn-small" type="submit">
                    Link
                  </button>
                </form>
              </section>
            ) : null}

            <section className="admin-batch-section">
              <h4>Published winners</h4>
              <p className="admin-hint">
                Shown on the public leaderboard when batch state is <strong>PUBLISHED</strong>. Submission
                must match the content type you select.
              </p>
              {batch.winners.length > 0 ? (
                <table className="admin-table admin-table-compact">
                  <thead>
                    <tr>
                      <th>Award</th>
                      <th>Creator</th>
                      <th>Type</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.winners.map((w) => (
                      <tr key={w.id}>
                        <td>{w.awardName}</td>
                        <td>{w.submission.creatorName}</td>
                        <td>{labelContentType(w.contentType)}</td>
                        <td>
                          <form action={deletePublishedWinner}>
                            <input type="hidden" name="winnerId" value={w.id} />
                            <button type="submit" className="btn-danger-ghost btn-small">
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="admin-empty">No winners for this batch yet.</p>
              )}

              <form action={createPublishedWinner} className="admin-stack-form">
                <input type="hidden" name="batchId" value={batch.id} />
                {batchSubs.length > 0 ? (
                  <div className="form-field">
                    <label htmlFor={`sub-${batch.id}`}>Submission</label>
                    <select id={`sub-${batch.id}`} name="submissionId" required className="admin-select-full">
                      <option value="">— Select —</option>
                      {batchSubs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.creatorName} · {labelContentType(s.contentType)} · {s.id.slice(0, 8)}…
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-field">
                    <label htmlFor={`sid-${batch.id}`}>Submission ID</label>
                    <input
                      id={`sid-${batch.id}`}
                      name="submissionId"
                      placeholder="cuid from Prisma Studio"
                      required
                      className="admin-select-full"
                    />
                    <p className="admin-hint">
                      No submissions linked to this batch yet. Paste a <code>Submission.id</code> or sync
                      rows from the form later.
                    </p>
                  </div>
                )}
                <div className="form-field">
                  <label htmlFor={`award-${batch.id}`}>Award name</label>
                  <input id={`award-${batch.id}`} name="awardName" required placeholder="e.g. Best Game Mechanics" />
                </div>
                <div className="form-field">
                  <label htmlFor={`ct-${batch.id}`}>Content type</label>
                  <select id={`ct-${batch.id}`} name="contentType" className="admin-select-full" required>
                    <option value={ContentType.MINI_GAMES}>Mini Games</option>
                    <option value={ContentType.INTERACTIVE_CONTENT}>Interactive Content</option>
                  </select>
                </div>
                <button className="btn-primary btn-small" type="submit">
                  Add winner
                </button>
              </form>
            </section>
          </article>
        );
      })}

      <p className="admin-footer-row">
        <Link href="/admin">← Admin overview</Link>
        <SignOutButton />
      </p>
    </main>
  );
}
