"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "@/components/snackbar-context";

/**
 * Reads `toast=success|error` and optional `toastDescription` from the URL (after server-action redirects),
 * shows a snackbar, then strips those params.
 */
export function SnackbarFromSearchParams() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const toast = params.get("toast");
    if (toast !== "success" && toast !== "error") return;

    const message =
      params.get("toastDescription")?.trim() ||
      (toast === "success" ? "Done." : "Something went wrong.");

    if (toast === "success") showSuccess(message);
    else showError(message);

    params.delete("toast");
    params.delete("toastDescription");
    const next = params.toString();
    const target = next ? `${pathname}?${next}` : pathname;
    const id = window.setTimeout(() => {
      router.replace(target, { scroll: false });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, router, searchParams, showError, showSuccess]);

  return null;
}
