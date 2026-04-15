import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export type AppRole = "admin" | "participant" | "fallback_voter" | "internal_team";

function toAppRole(r: UserRole): AppRole {
  switch (r) {
    case UserRole.ADMIN:
      return "admin";
    case UserRole.PARTICIPANT:
      return "participant";
    case UserRole.FALLBACK_VOTER:
      return "fallback_voter";
    case UserRole.INTERNAL_TEAM:
      return "internal_team";
    default:
      return "participant";
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (user && (await bcrypt.compare(password, user.passwordHash))) {
          return {
            id: user.id,
            email: user.email,
            role: toAppRole(user.role),
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        if (user.id) token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const role = token.role;
        if (role === "admin" || role === "participant" || role === "fallback_voter" || role === "internal_team") {
          session.user.role = role;
        }
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },
});
