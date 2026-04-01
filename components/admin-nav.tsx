import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      <Link href="/admin">Overview</Link>
      <Link href="/admin/judges">Judges</Link>
      <Link href="/admin/submissions">Submissions &amp; sync</Link>
      <Link href="/admin/batches">Batches &amp; brackets</Link>
    </nav>
  );
}
