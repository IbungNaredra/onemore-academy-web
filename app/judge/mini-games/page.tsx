import Link from "next/link";
import { ContentType } from "@prisma/client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { JudgeLaneNav } from "@/components/judge-lane-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { JudgeQueueView } from "@/app/judge/judge-queue-view";
import { getJudgeQueue } from "@/lib/judge-queue";
import { requireJudge } from "@/lib/guards";

export default async function JudgeMiniGamesPage() {
  await requireJudge();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login?callbackUrl=/judge/mini-games");

  const q = await getJudgeQueue(email, ContentType.MINI_GAMES);

  if (!q.ok) {
    return (
      <main className="panel-page judge-page judge-wide">
        <h2>Mini Games</h2>
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

  return (
    <main className="panel-page judge-page judge-wide">
      <JudgeLaneNav active="mini" />
      <h2>Mini Games — voting</h2>
      <p className="judge-lead">
        Signed in as <strong>{q.email}</strong>. Entries stay <strong>neutral (+0)</strong> until you press{" "}
        <strong>Vote</strong> for <strong>+1</strong>.
      </p>

      <JudgeQueueView q={q} returnPath="/judge/mini-games" showContentTypeInCards={false} />

      <p className="judge-footer-row">
        <Link href="/judge">← All lanes</Link>
        <Link href="/">Public site</Link>
        <SignOutButton />
      </p>
    </main>
  );
}
