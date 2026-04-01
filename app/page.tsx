import Link from "next/link";
import { ScheduleGrid } from "@/components/schedule-grid";
import { publicConfig } from "@/lib/challenge-data";
import { getScheduleBatches } from "@/lib/program-batch-public";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scheduleBatches = await getScheduleBatches();

  return (
    <main>
      <section id="overview" className="panel section-active">
        <div className="hero-card">
          <h2 className="hero-heading">Prompt Your Creativity &amp; Get the Rewards!</h2>
          <p className="hero-lead">
            onemore challenge is an internal testing program (30 Apr – 22 May 2026) where teams submit
            prompt-based experiences and judges evaluate each entry with simple +1 / 0 scoring. Winners
            are published per batch.
          </p>
          <ul className="hero-tags">
            <li>Shanghai, China</li>
            <li>Mini Games + Interactive Content</li>
            <li>4 winners per batch</li>
          </ul>
        </div>

        <div className="grid-compact">
          <article className="card card-accent">
            <h3 className="card-title">
              <span className="title-icon">◇</span> How to participate
            </h3>
            <ol className="flow-steps">
              <li>
                <strong>Create</strong> a prompt-based submission on onemore.
              </li>
              <li>
                <strong>Submit</strong> using the official Google Form.
              </li>
              <li>
                <strong>Get reviewed</strong> by assigned judges (+1 Good / 0 Neutral).
              </li>
              <li>
                <strong>Wait for publish</strong> on announcement day for your batch.
              </li>
            </ol>
            <a className="cta-btn" href={publicConfig.gformUrl} target="_blank" rel="noopener noreferrer">
              Submit via Google Form
            </a>
            <p className="terms-note">
              Set <code>NEXT_PUBLIC_GFORM_URL</code> in <code>.env.local</code> for the live form link.
            </p>
          </article>

          <article className="card">
            <h3 className="card-title">
              <span className="title-icon">◇</span> Challenge structure
            </h3>
            <ul className="terms-list">
              <li>
                <strong>Content types</strong> — Mini Games and Interactive Content are evaluated
                separately.
              </li>
              <li>
                <strong>Winner structure</strong> — 2 winners per content type, 4 total winners per batch.
              </li>
              <li>
                <strong>Award names</strong> — Best Game Mechanics, Most Addictive Experience, Best
                Interactive Story, Best Interactive Experience.
              </li>
              <li>
                <strong>Criteria</strong> — creativity, interactivity, uniqueness.
              </li>
              <li>
                <strong>Scoring</strong> — Good = +1, Neutral = 0.
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

        <article className="card">
          <details className="terms-collapsible">
            <summary>Terms &amp; Conditions (compact)</summary>
            <ul className="terms-list compact">
              <li>By submitting, you confirm the content is original or properly licensed.</li>
              <li>
                Submission data is synchronized from fixed Google Form columns (A–H); do not alter form
                structure.
              </li>
              <li>Batch assignment follows the form&apos;s batch choice (sheet col E), mapped to program batches.</li>
              <li>Judges evaluate in isolated queues; judges never see each other&apos;s votes.</li>
              <li>Only published results appear publicly on this website.</li>
            </ul>
          </details>
        </article>

        <p className="jump-link">
          <Link href="/leaderboard">Go to leaderboard</Link>
        </p>
      </section>
    </main>
  );
}
