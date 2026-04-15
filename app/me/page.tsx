import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  if (session.user.role === "admin") redirect("/admin");
  redirect("/vote");
}
