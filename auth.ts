import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        if (process.env.DATABASE_URL) {
          try {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user && (await bcrypt.compare(password, user.passwordHash))) {
              return {
                id: user.id,
                email: user.email,
                role: user.role === Role.ADMIN ? ("admin" as const) : ("judge" as const),
              };
            }
          } catch {
            /* DB down or not migrated yet — fall back to env credentials */
          }
        }

        const adminEmail = process.env.ADMIN_EMAIL ?? "admin@onemore.local";
        const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
        const judgeEmail = process.env.JUDGE_EMAIL ?? "judge@onemore.local";
        const judgePassword = process.env.JUDGE_PASSWORD ?? "judge123";

        if (email === adminEmail && password === adminPassword) {
          return { id: "admin", email, role: "admin" as const };
        }
        if (email === judgeEmail && password === judgePassword) {
          return { id: "judge", email, role: "judge" as const };
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
        session.user.role = role === "admin" || role === "judge" ? role : undefined;
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },
});
