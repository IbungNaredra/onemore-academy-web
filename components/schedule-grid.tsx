import { titleCaseState } from "@/lib/challenge-data";
import type { ScheduleBatchDto } from "@/lib/leaderboard-types";

export function ScheduleGrid({ batches }: { batches: ScheduleBatchDto[] }) {
  if (batches.length === 0) {
    return <p className="admin-empty">No batch schedule in the database yet. Run seed or add batches in Admin.</p>;
  }

  return (
    <div className="schedule-grid">
      {batches.map((b) => (
        <article className="schedule-item" key={b.id}>
          <h4>{b.label}</h4>
          <p>
            <strong>Submission</strong>: {b.submissionPeriod}
          </p>
          <p>
            <strong>Evaluation</strong>: {b.evaluationDate ?? "—"}
          </p>
          <p>
            <strong>Announcement</strong>: {b.announcementDate ?? "—"}
          </p>
          <span className={`state-pill state-${b.state}`}>{titleCaseState(b.state)}</span>
        </article>
      ))}
    </div>
  );
}
