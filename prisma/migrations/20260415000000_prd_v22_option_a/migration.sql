-- Destructive upgrade: remove legacy v1.3 judge + Sheet schema if present.
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "JudgeBracketAssignment" CASCADE;
DROP TABLE IF EXISTS "Bracket" CASCADE;
DROP TABLE IF EXISTS "JudgingRound" CASCADE;
DROP TABLE IF EXISTS "PublishedWinner" CASCADE;
DROP TABLE IF EXISTS "Submission" CASCADE;
DROP TABLE IF EXISTS "ProgramBatch" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TYPE IF EXISTS "JudgingRoundStatus" CASCADE;
DROP TYPE IF EXISTS "JudgingRoundKind" CASCADE;
DROP TYPE IF EXISTS "BatchPublicState" CASCADE;
DROP TYPE IF EXISTS "ContentType" CASCADE;
DROP TYPE IF EXISTS "Role" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'FALLBACK_VOTER', 'INTERNAL_TEAM', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContentCategory" AS ENUM ('MINI_GAMES', 'REAL_LIFE_PROMPT');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('OPEN', 'VOTING', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('ACTIVE', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "GroupValidity" AS ENUM ('PENDING', 'VALID', 'UNDER_REVIEWED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBatch" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "openAt" TIMESTAMP(3) NOT NULL,
    "votingAt" TIMESTAMP(3) NOT NULL,
    "concludedAt" TIMESTAMP(3) NOT NULL,
    "leaderboardPublishAt" TIMESTAMP(3),
    "autoTransition" BOOLEAN NOT NULL DEFAULT true,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN',
    "voterAssignmentDone" BOOLEAN NOT NULL DEFAULT false,
    "layer2EndsAt" TIMESTAMP(3),
    "winnersPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ContentCategory" NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "disqualifyReason" TEXT,
    "normalizedScore" DOUBLE PRECISION,
    "totalRatingsReceived" INTEGER NOT NULL DEFAULT 0,
    "isFinalist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGroup" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "category" "ContentCategory" NOT NULL,
    "layer" INTEGER NOT NULL,
    "validityStatus" "GroupValidity" NOT NULL DEFAULT 'PENDING',
    "completionRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSubmission" (
    "groupId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "GroupSubmission_pkey" PRIMARY KEY ("groupId","submissionId")
);

-- CreateTable
CREATE TABLE "GroupVoterAssignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupVoterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchVoterEligibility" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canVote" BOOLEAN NOT NULL DEFAULT false,
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BatchVoterEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedWinner" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "publishedScore" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramBatch_slug_key" ON "ProgramBatch"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramBatch_batchNumber_key" ON "ProgramBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "Submission_batchId_category_idx" ON "Submission"("batchId", "category");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_batchId_contentUrl_key" ON "Submission"("batchId", "contentUrl");

-- CreateIndex
CREATE INDEX "ContentGroup_batchId_category_layer_idx" ON "ContentGroup"("batchId", "category", "layer");

-- CreateIndex
CREATE INDEX "GroupVoterAssignment_userId_idx" ON "GroupVoterAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupVoterAssignment_groupId_userId_key" ON "GroupVoterAssignment"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Rating_groupId_idx" ON "Rating"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_submissionId_voterId_key" ON "Rating"("submissionId", "voterId");

-- CreateIndex
CREATE INDEX "BatchVoterEligibility_userId_idx" ON "BatchVoterEligibility"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchVoterEligibility_batchId_userId_key" ON "BatchVoterEligibility"("batchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedWinner_submissionId_key" ON "PublishedWinner"("submissionId");

-- CreateIndex
CREATE INDEX "PublishedWinner_batchId_idx" ON "PublishedWinner"("batchId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProgramBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGroup" ADD CONSTRAINT "ContentGroup_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProgramBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSubmission" ADD CONSTRAINT "GroupSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVoterAssignment" ADD CONSTRAINT "GroupVoterAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVoterAssignment" ADD CONSTRAINT "GroupVoterAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchVoterEligibility" ADD CONSTRAINT "BatchVoterEligibility_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProgramBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchVoterEligibility" ADD CONSTRAINT "BatchVoterEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedWinner" ADD CONSTRAINT "PublishedWinner_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProgramBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedWinner" ADD CONSTRAINT "PublishedWinner_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
