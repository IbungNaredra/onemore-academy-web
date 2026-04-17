import type { NextConfig } from "next";

/** Keep Prisma on the server bundle edge so the client engine + error types behave reliably (Next + Prisma guidance). */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
