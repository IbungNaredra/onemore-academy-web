import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "admin") redirect("/judge");
}

export async function requireJudge() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/judge");
  if (session.user.role !== "judge") redirect("/admin");
}
