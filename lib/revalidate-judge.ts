import { revalidatePath } from "next/cache";

/** Invalidate all judge voting surfaces (hub + per content-type lanes). */
export function revalidateJudgeViews() {
  revalidatePath("/judge");
  revalidatePath("/judge/mini-games");
  revalidatePath("/judge/interactive");
}
