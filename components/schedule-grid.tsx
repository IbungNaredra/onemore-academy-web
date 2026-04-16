import { batchStateDisplayName, type PublicBatchState, type ScheduleBatchDto } from "@/lib/leaderboard-types";

function stateClass(s: PublicBatchState): string {
  switch (s) {
    case "closed":
      return "state-closed";
    case "open":
      return "state-active";
    case "voting":
      return "state-evaluating";
    case "internal_voting":
      return "state-evaluating";
    case "concluded":
      return "state-evaluating";
    case "published":
      return "state-published";
    default:
      return "state-upcoming";
  }
}

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
          <span className={`state-pill ${stateClass(b.state)}`}>{batchStateDisplayName(b.state)}</span>
        </article>
      ))}
    </div>
  );
}
