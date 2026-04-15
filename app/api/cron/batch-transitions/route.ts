import { NextResponse } from "next/server";
import { runBatchTransitions } from "@/lib/batch-jobs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  await runBatchTransitions();
  return NextResponse.json({ ok: true });
}
