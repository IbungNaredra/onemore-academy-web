import { revalidatePath } from "next/cache";

export function revalidateJudgeViews() {
  revalidatePath("/vote");
}
