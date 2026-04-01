import Link from "next/link";
import { ContentType } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { JudgeLaneNav } from "@/components/judge-lane-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { getJudgeQueue } from "@/lib/judge-queue";
import { requireJudge } from "@/lib/guards";

export default async function JudgePage() {
  await requireJudge();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login?callbackUrl=/judge");

  const q = await getJudgeQueue(email);

  if (!q.ok) {
    return (
      <main className="panel-page judge-page judge-wide">
        <h2>Judge</h2>
        <p className="judge-lead">
          {q.reason === "no_db_user"
            ? "No staff account in the database matches this login. Use a judge account created under Admin → Judges, or run the seed with DATABASE_URL set."
            : "Your account is not set up as a judge in the database."}
        </p>
        <p className="admin-footer-row">
          <SignOutButton />
        </p>
      </main>
    );
  }

  const miniRows = q.rows.filter((r) => r.contentType === ContentType.MINI_GAMES);
  const intRows = q.rows.filter((r) => r.contentType === ContentType.INTERACTIVE_CONTENT);
  const miniVoted = miniRows.filter((r) => r.currentScore !== null).length;
  const intVoted = intRows.filter((r) => r.currentScore !== null).length;

  return (
    <main className="panel-page judge-page judge-hub">
      <JudgeLaneNav active="hub" />
      <h2>Judge voting</h2>
      <p className="judge-lead">
        Signed in as <strong>{q.email}</strong>. Each entry is <strong>neutral (+0)</strong> until you press{" "}
        <strong>Vote</strong> to give <strong>+1</strong>.
      </p>

      <ul className="judge-hub-lanes">
        <li className="judge-hub-card">
          <h3 className="judge-hub-card-title">Mini Games</h3>
          <p className="judge-hub-card-progress">
            <strong>{miniVoted}</strong> / {miniRows.length} scored
          </p>
          {miniRows.length > 0 && miniVoted === miniRows.length ? (
            <p className="judge-hub-card-status judge-hub-card-status-done">Lane complete</p>
          ) : null}
          <Link href="/judge/mini-games" className="judge-hub-card-cta">
            {miniRows.length === 0 ? "Open lane" : "Vote on Mini Games →"}
          </Link>
        </li>
        <li className="judge-hub-card">
          <h3 className="judge-hub-card-title">Interactive</h3>
          <p className="judge-hub-card-progress">
            <strong>{intVoted}</strong> / {intRows.length} scored
          </p>
          {intRows.length > 0 && intVoted === intRows.length ? (
            <p className="judge-hub-card-status judge-hub-card-status-done">Lane complete</p>
          ) : null}
          <Link href="/judge/interactive" className="judge-hub-card-cta">
            {intRows.length === 0 ? "Open lane" : "Vote on Interactive →"}
          </Link>
        </li>
      </ul>

      <p className="judge-footer-row">
        <Link href="/">← Public site</Link>
        <SignOutButton />
      </p>
    </main>
  );
}
