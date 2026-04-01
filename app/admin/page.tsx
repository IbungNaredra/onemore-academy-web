import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "admin") redirect("/judge");

  return (
    <main className="panel-page admin-wide">
      <AdminNav />
      <h2>Admin overview</h2>
      <p className="admin-lead">
        Signed in as <strong>{session.user.email}</strong>. Use the sections below to manage judges,
        batches, brackets, and published winners (the public leaderboard reads from the database).
      </p>
      <ul className="admin-link-list">
        <li>
          <Link href="/admin/judges">Judge accounts</Link> — create judges and reset passwords.
        </li>
        <li>
          <Link href="/admin/submissions">Submissions &amp; Google Sheet sync</Link> — pull rows (cols A–H),
          flagged col H, disqualify.
        </li>
        <li>
          <Link href="/admin/batches">Batches &amp; brackets</Link> — lifecycle, brackets, publish winners; open
          each batch&apos;s <strong>Results</strong> for scores &amp; judge completion.
        </li>
      </ul>
      <SignOutButton />
    </main>
  );
}
