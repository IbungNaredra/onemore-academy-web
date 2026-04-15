import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { AppRole } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth");
  return session;
}

export async function requireRole(allowed: AppRole[], redirectTo = "/auth") {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) {
    redirect(redirectTo);
  }
  return session;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

export async function requireInternalOrAdmin() {
  return requireRole(["admin", "internal_team"]);
}

/** Submit UGC: participants and fallback voters only (not admin or internal team). */
export async function requireParticipantSubmit() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth?callbackUrl=/submit");
  if (session.user.role !== "participant" && session.user.role !== "fallback_voter") {
    redirect("/info");
  }
  return session;
}

/** Vote queue / group voting: not admins (participants, fallback voters, internal team). */
export async function requireParticipantVoteQueue(authCallbackPath = "/vote") {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth?callbackUrl=${encodeURIComponent(authCallbackPath)}`);
  }
  if (session.user.role === "admin") {
    redirect("/info");
  }
  return session;
}
