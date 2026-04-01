import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaClient, Role, BatchPublicState, ContentType } from "@prisma/client";
import bcrypt from "bcryptjs";

// Prisma CLI only auto-loads `.env`; Next.js uses `.env.local` — load both so `prisma db seed` works.
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const prisma = new PrismaClient();

/** Col E–style text; maps to batch-1 via sync / batch-from-declared logic. */
const BATCH_1_DECLARED = "Batch 1 (30th April - 4th May 2026)";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@onemore.local";
  const judgeEmail = process.env.JUDGE_EMAIL ?? "judge@onemore.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const judgePassword = process.env.JUDGE_PASSWORD ?? "judge123";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const judgeHash = await bcrypt.hash(judgePassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: "Program admin",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: judgeEmail },
    update: { passwordHash: judgeHash },
    create: {
      email: judgeEmail,
      passwordHash: judgeHash,
      name: "Sample judge",
      role: Role.JUDGE,
    },
  });

  // E2E-friendly: Batch 1 = judging phase (manage brackets, vote). Batch 2 = open. Batch 3 = upcoming.
  const batches: Array<{
    slug: string;
    label: string;
    submissionStart: Date;
    submissionEnd: Date;
    evaluationDate: Date;
    announcementDate: Date;
    publicState: BatchPublicState;
  }> = [
    {
      slug: "batch-1",
      label: "Batch 1",
      submissionStart: new Date(Date.UTC(2026, 3, 30, 0, 0, 0)),
      submissionEnd: new Date(Date.UTC(2026, 4, 4, 23, 59, 59)),
      evaluationDate: new Date(Date.UTC(2026, 4, 5, 0, 0, 0)),
      announcementDate: new Date(Date.UTC(2026, 4, 6, 0, 0, 0)),
      publicState: BatchPublicState.EVALUATING,
    },
    {
      slug: "batch-2",
      label: "Batch 2",
      submissionStart: new Date(Date.UTC(2026, 4, 7, 0, 0, 0)),
      submissionEnd: new Date(Date.UTC(2026, 4, 11, 23, 59, 59)),
      evaluationDate: new Date(Date.UTC(2026, 4, 12, 0, 0, 0)),
      announcementDate: new Date(Date.UTC(2026, 4, 13, 0, 0, 0)),
      publicState: BatchPublicState.ACTIVE,
    },
    {
      slug: "batch-3",
      label: "Batch 3",
      submissionStart: new Date(Date.UTC(2026, 4, 14, 0, 0, 0)),
      submissionEnd: new Date(Date.UTC(2026, 4, 18, 23, 59, 59)),
      evaluationDate: new Date(Date.UTC(2026, 4, 19, 0, 0, 0)),
      announcementDate: new Date(Date.UTC(2026, 4, 20, 0, 0, 0)),
      publicState: BatchPublicState.UPCOMING,
    },
  ];

  for (const b of batches) {
    await prisma.programBatch.upsert({
      where: { slug: b.slug },
      update: {
        label: b.label,
        submissionStart: b.submissionStart,
        submissionEnd: b.submissionEnd,
        evaluationDate: b.evaluationDate,
        announcementDate: b.announcementDate,
        publicState: b.publicState,
        ...(b.slug === "batch-1" ? { judgingLockedAt: null } : {}),
      },
      create: {
        slug: b.slug,
        label: b.label,
        submissionStart: b.submissionStart,
        submissionEnd: b.submissionEnd,
        evaluationDate: b.evaluationDate,
        announcementDate: b.announcementDate,
        publicState: b.publicState,
      },
    });
  }

  await resetBatch1ForVotingDemo();
  await seedBulkLoadSubmissions(100, 20);
  await seedJudgeBracketsForBatch1();

  console.log(
    "Seed finished: users; batches (Batch1=EVALUATING, Batch2=ACTIVE, Batch3=UPCOMING); Batch1 test UGC: 100 Mini Games + 20 Interactive; judge assigned to brackets.",
  );
}

const VOTING_E2E_EMAIL_SUFFIX = "@voting-e2e.onemore.local";
const BULK_LOAD_EMAIL_SUFFIX = "@bulk-load.onemore.local";

/** Clears Batch 1 winners and removes seed-only submissions (`*@voting-e2e.*` / `*@bulk-load.*`) + votes; Sheet-synced rows stay. */
async function resetBatch1ForVotingDemo() {
  const batch = await prisma.programBatch.findUnique({ where: { slug: "batch-1" } });
  if (!batch) return;

  await prisma.publishedWinner.deleteMany({ where: { batchId: batch.id } });

  const testSubs = await prisma.submission.findMany({
    where: {
      programBatchId: batch.id,
      OR: [
        { creatorEmail: { endsWith: VOTING_E2E_EMAIL_SUFFIX } },
        { creatorEmail: { endsWith: BULK_LOAD_EMAIL_SUFFIX } },
      ],
    },
    select: { id: true },
  });
  const ids = testSubs.map((s) => s.id);
  if (ids.length > 0) {
    await prisma.vote.deleteMany({ where: { submissionId: { in: ids } } });
    await prisma.submission.deleteMany({ where: { id: { in: ids } } });
  }
}

/** Deterministic bulk UGC for load / multi-round tests (unique email + URL per row). */
async function seedBulkLoadSubmissions(miniCount: number, interactiveCount: number) {
  const batch = await prisma.programBatch.findUnique({ where: { slug: "batch-1" } });
  if (!batch) return;

  const now = new Date();
  const rows: Array<{
    creatorEmail: string;
    creatorName: string;
    contentUrl: string;
    contentType: ContentType;
  }> = [];

  for (let i = 1; i <= miniCount; i++) {
    const n = String(i).padStart(3, "0");
    rows.push({
      creatorEmail: `bulk-mini-${n}${BULK_LOAD_EMAIL_SUFFIX}`,
      creatorName: `Bulk Mini #${n}`,
      contentUrl: `https://example.com/bulk-load/batch1/mini/${i}`,
      contentType: ContentType.MINI_GAMES,
    });
  }
  for (let i = 1; i <= interactiveCount; i++) {
    const n = String(i).padStart(2, "0");
    rows.push({
      creatorEmail: `bulk-ic-${n}${BULK_LOAD_EMAIL_SUFFIX}`,
      creatorName: `Bulk Interactive #${n}`,
      contentUrl: `https://example.com/bulk-load/batch1/interactive/${i}`,
      contentType: ContentType.INTERACTIVE_CONTENT,
    });
  }

  for (const row of rows) {
    await prisma.submission.upsert({
      where: {
        creatorEmail_contentUrl: {
          creatorEmail: row.creatorEmail,
          contentUrl: row.contentUrl,
        },
      },
      create: {
        submittedAt: now,
        creatorEmail: row.creatorEmail,
        creatorName: row.creatorName,
        contentUrl: row.contentUrl,
        contentType: row.contentType,
        programBatchId: batch.id,
        batchSelfDeclared: BATCH_1_DECLARED,
        division: "BULK_SEED",
        eliminatedFromJudging: false,
      },
      update: {
        submittedAt: now,
        creatorName: row.creatorName,
        contentType: row.contentType,
        programBatchId: batch.id,
        batchSelfDeclared: BATCH_1_DECLARED,
        disqualified: false,
        eliminatedFromJudging: false,
        needsTypeReview: false,
        contentTypeRaw: null,
      },
    });
  }
}

async function seedJudgeBracketsForBatch1() {
  const batch = await prisma.programBatch.findUnique({ where: { slug: "batch-1" } });
  if (!batch) return;
  const judgeEmail = process.env.JUDGE_EMAIL ?? "judge@onemore.local";
  const judge = await prisma.user.findUnique({ where: { email: judgeEmail } });
  if (!judge) return;

  let brMini = await prisma.bracket.findFirst({
    where: { batchId: batch.id, contentType: ContentType.MINI_GAMES },
  });
  if (!brMini) {
    brMini = await prisma.bracket.create({
      data: { batchId: batch.id, contentType: ContentType.MINI_GAMES, sortOrder: 0 },
    });
  }

  let brInteractive = await prisma.bracket.findFirst({
    where: { batchId: batch.id, contentType: ContentType.INTERACTIVE_CONTENT },
  });
  if (!brInteractive) {
    brInteractive = await prisma.bracket.create({
      data: { batchId: batch.id, contentType: ContentType.INTERACTIVE_CONTENT, sortOrder: 0 },
    });
  }

  await prisma.submission.updateMany({
    where: { programBatchId: batch.id, contentType: ContentType.MINI_GAMES },
    data: { bracketId: brMini.id },
  });
  await prisma.submission.updateMany({
    where: { programBatchId: batch.id, contentType: ContentType.INTERACTIVE_CONTENT },
    data: { bracketId: brInteractive.id },
  });

  await prisma.judgeBracketAssignment.upsert({
    where: { userId_bracketId: { userId: judge.id, bracketId: brMini.id } },
    create: { userId: judge.id, bracketId: brMini.id },
    update: {},
  });
  await prisma.judgeBracketAssignment.upsert({
    where: { userId_bracketId: { userId: judge.id, bracketId: brInteractive.id } },
    create: { userId: judge.id, bracketId: brInteractive.id },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
