import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { adminDisqualify } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  await requireAdmin();

  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true, batch: true },
  });

  return (
    <main className="panel">
      <h2 className="section-h2">Submissions</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>User</th>
              <th>Category</th>
              <th>URL</th>
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
                    <button type="submit" className="admin-table-btn" disabled={s.status === "DISQUALIFIED"}>
                      DQ
                    </button>
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
