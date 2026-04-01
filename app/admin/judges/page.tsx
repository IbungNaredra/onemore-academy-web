import { Role } from "@prisma/client";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { AddJudgeForm, ResetJudgePasswordForm } from "@/components/admin-judge-forms";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminJudgesPage() {
  await requireAdmin();
  const judges = await prisma.user.findMany({
    where: { role: Role.JUDGE },
    orderBy: { email: "asc" },
  });

  return (
    <main className="panel-page admin-wide">
      <AdminNav />
      <h2>Judge accounts</h2>
      <p className="admin-lead">
        Create judges and set new passwords. Judges sign in via the footer <strong>Staff</strong> link.
      </p>
      <AddJudgeForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>New password</th>
            </tr>
          </thead>
          <tbody>
            {judges.length === 0 ? (
              <tr>
                <td colSpan={3} className="admin-empty">
                  No judges yet. Add one above.
                </td>
              </tr>
            ) : (
              judges.map((j) => (
                <tr key={j.id}>
                  <td>{j.email}</td>
                  <td>{j.name ?? "—"}</td>
                  <td>
                    <ResetJudgePasswordForm userId={j.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="admin-footer-row">
        <Link href="/admin">← Admin overview</Link>
        <SignOutButton />
      </p>
    </main>
  );
}
