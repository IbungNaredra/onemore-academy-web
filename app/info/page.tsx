import Link from "next/link";
import { ScheduleGrid } from "@/components/schedule-grid";
import { getScheduleBatches } from "@/lib/program-batch-public";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const scheduleBatches = await getScheduleBatches();

  return (
    <main>
      <section className="panel section-active">
        <div className="hero-card">
          <h2 className="hero-heading">Prompt Your Creativity &amp; Get the Rewards!</h2>
          <p className="hero-lead">
            onemore Internal Testing (PRD v2.2) — participants submit UGC on this site, vote in assigned groups with
            1–5 scores, and winners are published each Wednesday (Beijing time).
          </p>
          <ul className="hero-tags">
            <li>UTC+8 schedule</li>
            <li>Mini Games + Real Life + Prompt</li>
            <li>Peer voting + normalized scores</li>
          </ul>
        </div>

        <div className="grid-compact">
          <article className="card card-accent">
            <h3 className="card-title">
              <span className="title-icon">◇</span> How to participate
            </h3>
            <ol className="flow-steps">
              <li>
                <strong>Register</strong> with your Garena email.
              </li>
              <li>
                <strong>Submit</strong> during OPEN using the Submit tab (https link validated).
              </li>
              <li>
                <strong>Vote</strong> on assigned groups during VOTING (all scores 1–5 in one submit).
              </li>
              <li>
                <strong>Leaderboard</strong> after admin publish.
              </li>
            </ol>
            <Link className="cta-btn" href="/auth">
              Sign in / Register
            </Link>
          </article>

          <article className="card">
            <h3 className="card-title">
              <span className="title-icon">◇</span> Structure
            </h3>
            <ul className="terms-list">
              <li>
                <strong>Categories</strong> — Mini Games and Real Life + Prompt are separate.
              </li>
              <li>
                <strong>Batches</strong> — OPEN → VOTING → CONCLUDED; auto transitions optional (cron).
              </li>
              <li>
                <strong>Scoring</strong> — 1–5 per submission in your assigned groups; normalized for fairness.
              </li>
            </ul>
          </article>
        </div>

        <article className="card schedule-card">
          <h3 className="card-title">
            <span className="title-icon">◇</span> Batch schedule
          </h3>
          <ScheduleGrid batches={scheduleBatches} />
        </article>

        <p className="jump-link">
          <Link href="/leaderboard">Leaderboard</Link>
        </p>
      </section>
    </main>
  );
}
