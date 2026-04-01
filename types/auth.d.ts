import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: "admin" | "judge";
  }

  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "admin" | "judge";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "judge";
  }
}
