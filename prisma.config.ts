import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

// ES modules hoist static `import` above all code — Prisma would load before dotenv and skip `.env.local`.
// Load env first, then import `prisma/config`.
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { defineConfig } = await import("prisma/config");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
