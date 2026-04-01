"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JUDGE_ERROR_MESSAGES } from "@/lib/snackbar-url";
import { JUDGE_VOTE_RETURN_PATHS } from "@/lib/judge-return-path";
import { useSnackbar } from "@/components/snackbar-context";

/**
 * Shows snackbars from URL params (after server-action redirects) and removes those params.
 * Supported:
 * - `toast=success|error` + optional `toastDescription`
 * - `/judge…?error=…` (judge vote redirects; hub + per-lane routes)
 * - `/admin/submissions?sync=err&msg=…`
 */
export function SnackbarFromSearchParams() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const toast = params.get("toast");
    const hasJudgeError =
      (JUDGE_VOTE_RETURN_PATHS as readonly string[]).includes(pathname) && params.get("error");
    const hasSyncErr = pathname === "/admin/submissions" && params.get("sync") === "err" && params.get("msg");

    const hasSomething =
      toast === "success" ||
      toast === "error" ||
      hasJudgeError ||
      hasSyncErr;

    if (!hasSomething) return;

    let message = "";
    let variant: "success" | "error" = "success";
    const keysToDelete: string[] = [];

    if (toast === "success" || toast === "error") {
      variant = toast;
      message =
        params.get("toastDescription")?.trim() ||
        (toast === "success" ? "Done." : "Something went wrong.");
      keysToDelete.push("toast", "toastDescription");
    } else if (hasJudgeError) {
      variant = "error";
      const code = params.get("error") ?? "";
      message = JUDGE_ERROR_MESSAGES[code] ?? "An error occurred.";
      keysToDelete.push("error");
    } else if (hasSyncErr) {
      variant = "error";
      message = params.get("msg") ?? "Sync failed.";
      keysToDelete.push("sync", "msg");
    }

    if (variant === "success") showSuccess(message);
    else showError(message);

    keysToDelete.forEach((k) => params.delete(k));
    const next = params.toString();
    const target = next ? `${pathname}?${next}` : pathname;
    // Defer stripping query params until after React commits the snackbar. Immediate
    // `router.replace` with App Router can run in the same turn as navigation updates
    // and the toast never paints in production (especially after server redirects).
    const id = window.setTimeout(() => {
      router.replace(target, { scroll: false });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, router, searchParams, showError, showSuccess]);

  return null;
}
