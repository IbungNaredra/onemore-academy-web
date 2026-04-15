import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { isValidDivision } from "@/lib/divisions";

function isGarenaEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at === -1) return false;
  const domain = lower.slice(at + 1);
  return domain.includes("garena");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const division = String(body.division ?? "");

    if (!email || !password || !name || !division) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!isGarenaEmail(email)) {
      return NextResponse.json({ error: "Email must be a @garena domain address" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!isValidDivision(division)) {
      return NextResponse.json({ error: "Invalid division" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        division,
        role: UserRole.PARTICIPANT,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
