import { LeaderboardView } from "@/components/leaderboard-view";
import { getLeaderboardBatches } from "@/lib/program-batch-public";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const batches = await getLeaderboardBatches();
  return (
    <main>
      <LeaderboardView batches={batches} />
    </main>
  );
}
