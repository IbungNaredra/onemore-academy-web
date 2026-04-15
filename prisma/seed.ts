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

  const demoParticipant = "participant.demo@garena.com";
  const pHash = await bcrypt.hash("participant123", 10);
  await prisma.user.upsert({
    where: { email: demoParticipant },
    update: { passwordHash: pHash },
    create: {
      email: demoParticipant,
      passwordHash: pHash,
      name: "Demo Participant",
      division: "Others",
      role: UserRole.PARTICIPANT,
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
  const part = await prisma.user.findUnique({ where: { email: demoParticipant } });
  if (b1 && part) {
    await prisma.submission.upsert({
      where: {
        batchId_contentUrl: {
          batchId: b1.id,
          contentUrl: "https://example.com/demo-ugc/batch1",
        },
      },
      create: {
        batchId: b1.id,
        userId: part.id,
        category: ContentCategory.MINI_GAMES,
        contentUrl: "https://example.com/demo-ugc/batch1",
      },
      update: {},
    });
    await prisma.batchVoterEligibility.upsert({
      where: { batchId_userId: { batchId: b1.id, userId: part.id } },
      create: { batchId: b1.id, userId: part.id, canVote: true, adminOverride: false },
      update: { canVote: true },
    });
  }

  console.log("Seed OK: admin", adminEmail, "; demo", demoParticipant, "/ participant123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
