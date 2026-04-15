import "next-auth";

type AppRole = "admin" | "participant" | "fallback_voter" | "internal_team";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: AppRole;
  }
  interface Session {
    user: User & { id: string; role: AppRole };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    sub?: string;
  }
}
