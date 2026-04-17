import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { ContentCategory, Prisma } from "@prisma/client";
import { AdminSubmissionsTable } from "@/components/admin-submissions-table";

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
    where.OR = [
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { contentTitle: { contains: q, mode: "insensitive" } },
    ];
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
            <span className="admin-filter-field__label">User / title</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="admin-input"
              placeholder="Email, name, or content title"
              aria-label="Search by user email, name, or content title"
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
        <AdminSubmissionsTable submissions={submissions} />
      </div>
    </main>
  );
}
