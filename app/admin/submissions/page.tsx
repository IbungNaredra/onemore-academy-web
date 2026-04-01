import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/sign-out-button";
import {
  fixSubmissionContentType,
  setSubmissionDisqualified,
  syncGoogleSheet,
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ContentType } from "@prisma/client";

export const dynamic = "force-dynamic";

function labelContentType(ct: ContentType) {
  return ct === ContentType.MINI_GAMES ? "Mini Games" : "Interactive Content";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function qp(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "?";
}

export default async function AdminSubmissionsPage(props: PageProps) {
  await requireAdmin();

  const sp = props.searchParams ? await props.searchParams : {};
  const sync = typeof sp.sync === "string" ? sp.sync : undefined;
  const flaggedOnly = sp.flagged === "1" || sp.flagged === "true";
  const dqOnly = sp.dq === "1" || sp.dq === "true";
  const batchFilter = typeof sp.batch === "string" ? sp.batch : undefined;

  const where: Prisma.SubmissionWhereInput = {};
  if (flaggedOnly) where.needsTypeReview = true;
  if (dqOnly) where.disqualified = true;
  if (batchFilter) where.programBatchId = batchFilter;

  const [submissions, batches] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: { programBatch: { select: { id: true, label: true } } },
      orderBy: { submittedAt: "desc" },
      take: 500,
    }),
    prisma.programBatch.findMany({ orderBy: { submissionStart: "asc" }, select: { id: true, label: true } }),
  ]);

  const flaggedCount = await prisma.submission.count({ where: { needsTypeReview: true } });
  const dqCount = await prisma.submission.count({ where: { disqualified: true } });

  return (
    <main className="panel-page admin-wide">
      <AdminNav />
      <h2>Submissions &amp; sync</h2>
      <p className="admin-lead">
        PRD §7: pull uses cols A–H. <strong>Deduplication:</strong> one database row per{" "}
        <strong>email + UGC link</strong> — if the sheet has more rows than unique pairs, re-sync updates the
        same rows. <strong>Batch</strong> is taken from the form&apos;s fixed choice in <strong>col E</strong>{" "}
        (Batch 1 / 2 / 3) and mapped to program batches by slug.
      </p>

      {sync === "ok" && (
        <p className="form-success" role="status">
          Sync finished: {qp(sp, "ins")} created, {qp(sp, "upd")} updated, col H flagged {qp(sp, "badh")},{" "}
          {qp(sp, "short")} short rows skipped, {qp(sp, "rows")} data rows.
        </p>
      )}
      <section className="admin-batch-section">
        <h4>Manual sync</h4>
        <p className="admin-hint">
          Requires <code>GOOGLE_SHEETS_SPREADSHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, and
          optional <code>GOOGLE_SHEETS_RANGE</code> (default <code>Form Responses 1!A:H</code>) in{" "}
          <code>.env.local</code>. Share the spreadsheet with the service account client email.
        </p>
        <form action={syncGoogleSheet}>
          <button className="btn-primary btn-small" type="submit">
            Pull from Google Sheet
          </button>
        </form>
      </section>

      <section className="admin-batch-section">
        <h4>Filters</h4>
        <p className="admin-filter-links">
          <Link href="/admin/submissions" className={!flaggedOnly && !dqOnly ? "admin-filter-active" : ""}>
            All
          </Link>
          {" · "}
          <Link
            href="/admin/submissions?flagged=1"
            className={flaggedOnly ? "admin-filter-active" : ""}
          >
            Flagged col H ({flaggedCount})
          </Link>
          {" · "}
          <Link href="/admin/submissions?dq=1" className={dqOnly ? "admin-filter-active" : ""}>
            Disqualified ({dqCount})
          </Link>
        </p>
        <form method="get" className="admin-row-form">
          <label htmlFor="batch-filter" className="visually-hidden">
            Batch
          </label>
          <select id="batch-filter" name="batch" className="admin-select" defaultValue={batchFilter ?? ""}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          {flaggedOnly ? <input type="hidden" name="flagged" value="1" /> : null}
          {dqOnly ? <input type="hidden" name="dq" value="1" /> : null}
          <button className="btn-ghost btn-small" type="submit">
            Apply
          </button>
        </form>
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-compact">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Submitted (col A)</th>
              <th>Batch</th>
              <th>Type</th>
              <th>DQ</th>
              <th>UGC</th>
              <th>Fix / DQ</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{s.creatorName}</td>
                <td className="admin-mono admin-nowrap">
                  {s.submittedAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td title={s.batchSelfDeclared ? `Col E: ${s.batchSelfDeclared}` : undefined}>
                  {s.programBatch?.label ?? "—"}
                </td>
                <td>
                  {labelContentType(s.contentType)}
                  {s.needsTypeReview ? (
                    <span className="admin-badge-warn" title={s.contentTypeRaw ?? ""}>
                      {" "}
                      (raw: {s.contentTypeRaw ?? "?"})
                    </span>
                  ) : null}
                </td>
                <td>{s.disqualified ? <span className="admin-badge-dq">Yes</span> : "—"}</td>
                <td className="admin-cell-clip">
                  <a href={s.contentUrl} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </td>
                <td className="admin-actions-cell">
                  {s.needsTypeReview ? (
                    <form action={fixSubmissionContentType} className="admin-action-form">
                      <input type="hidden" name="submissionId" value={s.id} />
                      <select name="contentType" className="admin-select admin-select-tiny" required>
                        <option value="MINI_GAMES">Mini Games</option>
                        <option value="INTERACTIVE_CONTENT">Interactive Content</option>
                      </select>
                      <button type="submit" className="btn-primary btn-small">
                        Set type
                      </button>
                    </form>
                  ) : null}
                  {s.disqualified ? (
                    <form action={setSubmissionDisqualified} className="admin-action-form">
                      <input type="hidden" name="submissionId" value={s.id} />
                      <input type="hidden" name="disqualified" value="0" />
                      <button type="submit" className="btn-ghost btn-small">
                        Reinstate
                      </button>
                    </form>
                  ) : (
                    <form action={setSubmissionDisqualified} className="admin-action-form">
                      <input type="hidden" name="submissionId" value={s.id} />
                      <input type="hidden" name="disqualified" value="1" />
                      <input
                        name="reason"
                        placeholder="Reason"
                        className="admin-input-tiny"
                        aria-label="Disqualify reason"
                      />
                      <button type="submit" className="btn-danger-ghost btn-small">
                        Disqualify
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 ? <p className="admin-empty">No rows match.</p> : null}
      </div>

      <p className="admin-footer-row">
        <Link href="/admin">← Admin overview</Link>
        <SignOutButton />
      </p>
    </main>
  );
}
