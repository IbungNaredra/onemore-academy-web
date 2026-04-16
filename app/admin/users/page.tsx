import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { adminResetPassword, adminSetUserRole } from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });

  return (
    <main className="panel">
      <h2 className="section-h2">Users</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>New password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>
                  <form
                    className="admin-table-form"
                    action={async (fd: FormData) => {
                      "use server";
                      const role = String(fd.get("role")) as UserRole;
                      await adminSetUserRole(u.id, role);
                    }}
                  >
                    <select name="role" defaultValue={u.role} className="admin-input">
                      {Object.values(UserRole).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Saving…">
                      Save role
                    </FormSubmitButton>
                  </form>
                </td>
                <td>
                  <form
                    className="admin-table-form"
                    action={async (fd: FormData) => {
                      "use server";
                      await adminResetPassword(u.id, String(fd.get("pw") ?? ""));
                    }}
                  >
                    <input name="pw" type="password" className="admin-input" placeholder="temp password" required />
                    <FormSubmitButton type="submit" className="admin-table-btn" pendingLabel="Updating…">
                      Set
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
