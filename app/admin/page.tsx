import Link from "next/link";
import { requireAdmin } from "@/lib/guards";

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="panel">
      <h2 className="section-h2">Admin</h2>
      <ul className="terms-list">
        <li>
          <Link href="/admin/users">Users</Link> — roles, canVote, password reset
        </li>
        <li>
          <Link href="/admin/batch">Batches</Link> — status, auto transitions, voter assignment
        </li>
        <li>
          <Link href="/admin/submissions">Submissions</Link> — view, disqualify
        </li>
        <li>
          <Link href="/admin/winners">Winners</Link> — publish to leaderboard
        </li>
      </ul>
    </main>
  );
}
