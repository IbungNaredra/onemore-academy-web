import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// Prisma 6 with this file skips Prisma's built-in dotenv — we must load env here.
// Resolve paths from this file (not `cwd`) so CLI invocations still find `.env.local`.
const projectRoot = dirname(fileURLToPath(import.meta.url));

// `.env.local` first (override) so Neon `DATABASE_URL` wins over a copied `.env` with Docker localhost.
loadEnv({ path: resolve(projectRoot, ".env.local"), override: true });
loadEnv({ path: resolve(projectRoot, ".env") });

/**
 * Dotenv can miss values (BOM, encoding, or a Windows `DATABASE_URL` shadowing the file).
 * Force the last `DATABASE_URL=` line from `.env.local` so Neon URLs always apply when present.
 */
function applyDatabaseUrlFromEnvLocalFile(): void {
  const p = resolve(projectRoot, ".env.local");
  if (!existsSync(p)) return;
  let raw = readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  let last: string | undefined;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    last = v;
  }
  if (last) process.env.DATABASE_URL = last;
}

applyDatabaseUrlFromEnvLocalFile();

const { defineConfig } = await import("prisma/config");

const databaseUrl = process.env.DATABASE_URL ?? "";

if (databaseUrl.includes("127.0.0.1") || databaseUrl.includes("localhost")) {
  console.warn(
    "[prisma.config] DATABASE_URL still references localhost. Put your Neon URL in `.env.local` as DATABASE_URL=... " +
      "or remove a Windows User `DATABASE_URL` (System Properties → Environment Variables) that overrides the file.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
