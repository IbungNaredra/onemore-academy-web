/**
 * Destructive: removes all submissions (UGC), voting artifacts, eligibility rows,
 * and every user except those with role ADMIN.
 *
 * Usage: npx tsx scripts/reset-nonadmin-and-ugc.ts
 * Requires DATABASE_URL (e.g. from .env.local).
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true, email: true },
  });
  if (admins.length === 0) {
    console.error("Refusing to run: no ADMIN user exists (would lock the app out).");
    process.exit(1);
  }
  console.log(`Keeping ${admins.length} ADMIN user(s): ${admins.map((a) => a.email).join(", ")}`);

  await prisma.$transaction(async (tx) => {
    const ratings = await tx.rating.deleteMany();
    const winners = await tx.publishedWinner.deleteMany();
    const gs = await tx.groupSubmission.deleteMany();
    const subs = await tx.submission.deleteMany();
    const gva = await tx.groupVoterAssignment.deleteMany();
    const cg = await tx.contentGroup.deleteMany();
    const elig = await tx.batchVoterEligibility.deleteMany();
    const users = await tx.user.deleteMany({
      where: { NOT: { role: UserRole.ADMIN } },
    });

    console.log(
      [
        `Deleted ratings: ${ratings.count}`,
        `published winners: ${winners.count}`,
        `group submissions: ${gs.count}`,
        `submissions (UGC): ${subs.count}`,
        `group voter assignments: ${gva.count}`,
        `content groups: ${cg.count}`,
        `batch voter eligibility rows: ${elig.count}`,
        `non-admin users: ${users.count}`,
      ].join("\n"),
    );

    await tx.programBatch.updateMany({
      data: {
        voterAssignmentDone: false,
        winnersPublishedAt: null,
        layer2EndsAt: null,
      },
    });
    console.log("Reset all batches: voterAssignmentDone=false, winnersPublishedAt=null, layer2EndsAt=null");
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
