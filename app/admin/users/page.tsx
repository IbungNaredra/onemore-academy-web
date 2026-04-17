import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { adminResetPassword, adminSetUserRole } from "@/app/actions/admin";
import { FormSubmitButton } from "@/components/form-submit-button";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string | string[]; role?: string | string[] };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();

  const sp = await searchParams;
  const rawQ = sp.q;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const rawRole = typeof sp.role === "string" ? sp.role.trim() : "";
  const roleFilter: UserRole | undefined = Object.values(UserRole).includes(rawRole as UserRole)
    ? (rawRole as UserRole)
    : undefined;

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (roleFilter) {
    where.role = roleFilter;
  }

  const users = await prisma.user.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { email: "asc" },
  });

  const hasFilters = Boolean(q || roleFilter);

  return (
    <main className="panel">
      <h2 className="section-h2">Users</h2>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <form method="get" className="admin-toolbar-form admin-filter-bar" role="search">
          <label className="admin-filter-field admin-filter-field--wide">
            <span className="admin-filter-field__label">Email or name</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="admin-input"
              placeholder="e.g. @garena or Wei"
              aria-label="Search by email or name"
            />
          </label>
          <label className="admin-filter-field">
            <span className="admin-filter-field__label">Role</span>
            <select name="role" className="admin-input" defaultValue={roleFilter ?? ""} aria-label="Filter by role">
              <option value="">All roles</option>
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-filter-field admin-filter-field--actions">
            <button type="submit" className="admin-table-btn">
              Apply
            </button>
            {hasFilters ? (
              <a href="/admin/users" className="nav-link">
                Clear filters
              </a>
            ) : null}
          </div>
        </form>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="admin-table admin-users-table">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">New password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="admin-users-table__email">{u.email}</td>
                <td className="admin-users-table__name">{u.name}</td>
                <td>
                  <form
                    className="admin-table-form admin-table-form--row"
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
                    <FormSubmitButton type="submit" className="admin-table-btn admin-users-table__btn" pendingLabel="…">
                      Save
                    </FormSubmitButton>
                  </form>
                </td>
                <td>
                  <form
                    className="admin-table-form admin-table-form--row"
                    action={async (fd: FormData) => {
                      "use server";
                      await adminResetPassword(u.id, String(fd.get("pw") ?? ""));
                    }}
                  >
                    <input name="pw" type="password" className="admin-input" placeholder="temp password" required />
                    <FormSubmitButton type="submit" className="admin-table-btn admin-users-table__btn" pendingLabel="…">
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
