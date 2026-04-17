/**
 * Completes pending Layer 1 vote assignments for seed UGC accounts
 * (test.ugc.p01@garena.com … test.ugc.p20@garena.com) so you can test
 * leaderboards and flows without clicking through every group.
 *
 * Optional: set TEST_VOTE_BOOST_EMAIL to your test user email; in each group,
 * that participant's submission gets 5, others get 3. If unset, every submission
 * gets 4 (neutral fill).
 *
 * Usage:
 *   npx tsx scripts/fill-ugc-test-votes.ts
 * Requires DATABASE_URL (e.g. from .env.local).
 *
 * Prereq: groups exist (batch was OPEN/VOTING when groups were built). If none,
 * set batch to VOTING and run admin "prepare for voting" / assign groups first.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaClient, ContentCategory } from "@prisma/client";
import { refreshNormalizedScoresForBatchCategory } from "@/lib/scoring";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const prisma = new PrismaClient();

const DEFAULT_BATCH_SLUG = "batch-1";

function scoreForSubmission(submissionUserEmail: string, boost: string | undefined): number {
  if (boost && submissionUserEmail.toLowerCase() === boost) return 5;
  return boost ? 3 : 4;
}

async function main() {
  const batchSlug = process.env.TEST_VOTE_BATCH_SLUG ?? DEFAULT_BATCH_SLUG;
  const boostEmail = process.env.TEST_VOTE_BOOST_EMAIL?.trim().toLowerCase();
  if (boostEmail) {
    console.log("Boost (score 5):", boostEmail, "| others in group: 3");
  } else {
    console.log("Neutral fill: all submissions scored 4 (set TEST_VOTE_BOOST_EMAIL to favor one user).");
  }

  const batch = await prisma.programBatch.findUnique({ where: { slug: batchSlug } });
  if (!batch) {
    console.error(`Batch not found: ${batchSlug}`);
    process.exit(1);
  }

  const assignments = await prisma.groupVoterAssignment.findMany({
    where: {
      completed: false,
      group: {
        batchId: batch.id,
        layer: 1,
      },
      user: {
        AND: [{ email: { startsWith: "test.ugc.p" } }, { email: { endsWith: "@garena.com" } }],
      },
    },
    include: {
      group: {
        include: {
          submissions: {
            include: {
              submission: { include: { user: { select: { email: true } } } },
            },
          },
        },
      },
    },
  });

  if (assignments.length === 0) {
    console.log("No pending UGC Layer 1 assignments. Build groups (batch OPEN/VOTING) or votes are already complete.");
    return;
  }

  let done = 0;
  const categoriesTouched = new Set<ContentCategory>();

  for (const a of assignments) {
    const { group } = a;
    const subRows = group.submissions;
    if (subRows.length === 0) continue;

    await prisma.$transaction(async (tx) => {
      for (const row of subRows) {
        const email = row.submission.user.email.toLowerCase();
        const score = scoreForSubmission(email, boostEmail);
        await tx.rating.create({
          data: {
            groupId: group.id,
            submissionId: row.submissionId,
            voterId: a.userId,
            score,
          },
        });
      }
      await tx.groupVoterAssignment.update({
        where: { id: a.id },
        data: { completed: true, completedAt: new Date() },
      });
    });

    categoriesTouched.add(group.category);
    done += 1;
  }

  for (const cat of categoriesTouched) {
    await refreshNormalizedScoresForBatchCategory(batch.id, cat);
  }

  console.log(`Filled ${done} assignment(s) on batch "${batchSlug}". Normalized scores refreshed for: ${[...categoriesTouched].join(", ")}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
