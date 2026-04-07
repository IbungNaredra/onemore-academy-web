import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Single instance per serverless isolate (Vercel). Reusing `globalThis` avoids opening
 * extra pools per request and matches Prisma’s serverless guidance.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
