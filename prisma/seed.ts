import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaClient, UserRole, BatchStatus, ContentCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const prisma = new PrismaClient();

const B1 = {
  openAt: new Date("2026-05-06T16:00:00.000Z"),
  votingAt: new Date("2026-05-12T16:00:00.000Z"),
  concludedAt: new Date("2026-05-13T16:00:00.000Z"),
  leaderboardPublishAt: new Date("2026-05-14T08:00:00.000Z"),
};
const B2 = {
  openAt: new Date("2026-05-13T16:00:00.000Z"),
  votingAt: new Date("2026-05-19T16:00:00.000Z"),
  concludedAt: new Date("2026-05-20T16:00:00.000Z"),
  leaderboardPublishAt: new Date("2026-05-21T08:00:00.000Z"),
};
const B3 = {
  openAt: new Date("2026-05-20T16:00:00.000Z"),
  votingAt: new Date("2026-05-26T16:00:00.000Z"),
  concludedAt: new Date("2026-05-27T16:00:00.000Z"),
  leaderboardPublishAt: new Date("2026-05-28T08:00:00.000Z"),
};

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin.onemorechallenge@garena.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, name: "Program Admin", role: UserRole.ADMIN, division: "Admin" },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: "Program Admin",
      division: "Admin",
      role: UserRole.ADMIN,
    },
  });

  const batchDefs = [
    { slug: "batch-1", label: "Batch 1", batchNumber: 1, ...B1 },
    { slug: "batch-2", label: "Batch 2", batchNumber: 2, ...B2 },
    { slug: "batch-3", label: "Batch 3", batchNumber: 3, ...B3 },
  ];

  for (const b of batchDefs) {
    await prisma.programBatch.upsert({
      where: { slug: b.slug },
      update: {
        label: b.label,
        openAt: b.openAt,
        votingAt: b.votingAt,
        concludedAt: b.concludedAt,
        leaderboardPublishAt: b.leaderboardPublishAt,
        status: BatchStatus.OPEN,
        autoTransition: true,
        voterAssignmentDone: false,
      },
      create: {
        slug: b.slug,
        label: b.label,
        batchNumber: b.batchNumber,
        openAt: b.openAt,
        votingAt: b.votingAt,
        concludedAt: b.concludedAt,
        leaderboardPublishAt: b.leaderboardPublishAt,
        status: BatchStatus.OPEN,
        autoTransition: true,
        voterAssignmentDone: false,
      },
    });
  }

  const b1 = await prisma.programBatch.findUnique({ where: { slug: "batch-1" } });
  const allBatches = await prisma.programBatch.findMany({ select: { id: true } });

  /** 20 participants on Batch 1 — 10 MINI_GAMES + 10 REAL_LIFE_PROMPT (1 UGC each). */
  const testParticipantPassword = process.env.TEST_PARTICIPANT_PASSWORD ?? "test123456";
  const testHash = await bcrypt.hash(testParticipantPassword, 10);
  if (b1) {
    for (let i = 1; i <= 20; i++) {
      const email = `test.ugc.p${String(i).padStart(2, "0")}@garena.com`;
      const category =
        i <= 10 ? ContentCategory.MINI_GAMES : ContentCategory.REAL_LIFE_PROMPT;
      const slug = i <= 10 ? `mini-${i}` : `rl-${i - 10}`;
      const contentUrl = `https://example.com/test-ugc/batch-1/${slug}`;

      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash: testHash, name: `Test UGC ${i}`, division: "Others", role: UserRole.PARTICIPANT },
        create: {
          email,
          passwordHash: testHash,
          name: `Test UGC ${i}`,
          division: "Others",
          role: UserRole.PARTICIPANT,
        },
      });

      await prisma.submission.upsert({
        where: {
          batchId_contentUrl: { batchId: b1.id, contentUrl },
        },
        create: {
          batchId: b1.id,
          userId: user.id,
          category,
          contentTitle: `Test title ${i}`,
          contentUrl,
        },
        update: { contentTitle: `Test title ${i}` },
      });

      await prisma.batchVoterEligibility.upsert({
        where: { batchId_userId: { batchId: b1.id, userId: user.id } },
        create: { batchId: b1.id, userId: user.id, canVote: true, adminOverride: false },
        update: { canVote: true },
      });
    }
  }

  /** Participants with no submission (voters only on Batch 1). Same password as load-test UGC cohort. */
  if (b1) {
    for (let i = 1; i <= 5; i++) {
      const email = `test.nosub.p${String(i).padStart(2, "0")}@garena.com`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          passwordHash: testHash,
          name: `Test No-Submit ${i}`,
          division: "Others",
          role: UserRole.PARTICIPANT,
        },
        create: {
          email,
          passwordHash: testHash,
          name: `Test No-Submit ${i}`,
          division: "Others",
          role: UserRole.PARTICIPANT,
        },
      });
      await prisma.batchVoterEligibility.upsert({
        where: { batchId_userId: { batchId: b1.id, userId: user.id } },
        create: { batchId: b1.id, userId: user.id, canVote: true, adminOverride: false },
        update: { canVote: true },
      });
    }
  }

  /** Internal team: 10 accounts (Layer 2 / finalist / Top 10). Override password with `TEST_INTERNAL_TEAM_PASSWORD`. */
  const internalTeamPassword = process.env.TEST_INTERNAL_TEAM_PASSWORD ?? "12345678";
  const internalTeamHash = await bcrypt.hash(internalTeamPassword, 10);
  for (let i = 1; i <= 10; i++) {
    const email = `internal.team.it${String(i).padStart(2, "0")}@garena.com`;
    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: internalTeamHash,
        name: `Internal Team ${i}`,
        division: "Others",
        role: UserRole.INTERNAL_TEAM,
      },
      create: {
        email,
        passwordHash: internalTeamHash,
        name: `Internal Team ${i}`,
        division: "Others",
        role: UserRole.INTERNAL_TEAM,
      },
    });
  }

  /** Fallback voters: 5 accounts — voter eligibility on all batches (same pattern as admin role change). */
  const fallbackPassword = process.env.TEST_FALLBACK_VOTER_PASSWORD ?? testParticipantPassword;
  const fallbackHash = await bcrypt.hash(fallbackPassword, 10);
  for (let i = 1; i <= 5; i++) {
    const email = `test.fallback.p${String(i).padStart(2, "0")}@garena.com`;
    const fb = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: fallbackHash,
        name: `Fallback Voter ${i}`,
        division: "Others",
        role: UserRole.FALLBACK_VOTER,
      },
      create: {
        email,
        passwordHash: fallbackHash,
        name: `Fallback Voter ${i}`,
        division: "Others",
        role: UserRole.FALLBACK_VOTER,
      },
    });
    for (const b of allBatches) {
      await prisma.batchVoterEligibility.upsert({
        where: { batchId_userId: { batchId: b.id, userId: fb.id } },
        create: { batchId: b.id, userId: fb.id, canVote: true, adminOverride: true },
        update: { canVote: true, adminOverride: true },
      });
    }
  }

  console.log("Seed OK: admin", adminEmail);
  if (b1) {
    console.log(
      "UGC submitters: 20 users test.ugc.p01@garena.com … test.ugc.p20@garena.com (password:",
      testParticipantPassword,
      ") — Batch 1: 10× MINI_GAMES, 10× REAL_LIFE_PROMPT",
    );
    console.log(
      "No-UGC voters: test.nosub.p01@garena.com … test.nosub.p05@garena.com (same password) — can vote on Batch 1, no submission",
    );
  }
  console.log(
    "Internal team: internal.team.it01@garena.com … internal.team.it10@garena.com (password:",
    internalTeamPassword,
    ")",
  );
  console.log(
    "Fallback voters: test.fallback.p01@garena.com … test.fallback.p05@garena.com (password:",
    fallbackPassword,
    ")",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
