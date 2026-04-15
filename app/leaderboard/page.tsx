import { LeaderboardView } from "@/components/leaderboard-view";
import { getFinalistsByBatch, getLeaderboardBatches } from "@/lib/program-batch-public";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const batches = await getLeaderboardBatches();
  const finalistsByBatch = await getFinalistsByBatch();
  const session = await auth();
  const showInternal =
    session?.user?.role === "admin" || session?.user?.role === "internal_team";

  return (
    <main>
      <LeaderboardView batches={batches} finalistsByBatch={finalistsByBatch} showInternal={showInternal} />
    </main>
  );
}
