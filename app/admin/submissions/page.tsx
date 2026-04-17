import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ContentCategory, Prisma } from "@prisma/client";
import { adminDisqualify } from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";
import { CopyContentIdButton } from "@/components/copy-content-id-button";

export const dynamic = "force-dynamic";

const CATEGORIES: ContentCategory[] = ["MINI_GAMES", "REAL_LIFE_PROMPT"];

type SearchParams = { q?: string | string[]; batch?: string | string[]; category?: string | string[] };

function firstString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v[0]) return String(v[0]).trim();
  return "";
}

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();

  const sp = await searchParams;
  const q = firstString(sp.q);
  const batchId = firstString(sp.batch);
  const categoryRaw = firstString(sp.category);
  const category: ContentCategory | undefined = CATEGORIES.includes(categoryRaw as ContentCategory)
    ? (categoryRaw as ContentCategory)
    : undefined;

  const where: Prisma.SubmissionWhereInput = {};
  if (q) {
    where.user = {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  if (batchId) {
    where.batchId = batchId;
  }
  if (category) {
    where.category = category;
  }

  const [submissions, batches] = await Promise.all([
    prisma.submission.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: true, batch: true },
    }),
    prisma.programBatch.findMany({
      orderBy: { batchNumber: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  const hasFilters = Boolean(q || batchId || category);

  return (
    <main className="panel">
      <h2 className="section-h2">Submissions</h2>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <form method="get" className="admin-toolbar-form admin-filter-bar" role="search">
          <label className="admin-filter-field admin-filter-field--wide">
            <span className="admin-filter-field__label">User</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="admin-input"
              placeholder="Email or name"
              aria-label="Search user by email or name"
            />
          </label>
          <label className="admin-filter-field">
            <span className="admin-filter-field__label">Batch</span>
            <select name="batch" className="admin-input" defaultValue={batchId} aria-label="Filter by batch">
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-filter-field">
            <span className="admin-filter-field__label">Category</span>
            <select name="category" className="admin-input" defaultValue={category ?? ""} aria-label="Filter by category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-filter-field admin-filter-field--actions">
            <button type="submit" className="admin-table-btn">
              Apply
            </button>
            {hasFilters ? (
              <a href="/admin/submissions" className="nav-link">
                Clear filters
              </a>
            ) : null}
          </div>
        </form>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>User</th>
              <th>Category</th>
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
                <td>
                  <a href={s.contentUrl} target="_blank" rel="noreferrer">
                    link
                  </a>
                </td>
                <td>
                  <code className="admin-mono" style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {s.id}
                  </code>
                  <div style={{ marginTop: "0.35rem" }}>
                    <CopyContentIdButton id={s.id} />
                  </div>
                </td>
                <td>{s.status}</td>
                <td>
                  <form
                    className="admin-table-form"
                    action={async (fd: FormData) => {
                      "use server";
                      await adminDisqualify(s.id, String(fd.get("reason") ?? "DQ"));
                    }}
                  >
                    <input name="reason" className="admin-input" placeholder="reason" required />
                    <FormSubmitButton
                      type="submit"
                      className="admin-table-btn"
                      disabled={s.status === "DISQUALIFIED"}
                      pendingLabel="Applying…"
                    >
                      DQ
                    </FormSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
