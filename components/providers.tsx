"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { SnackbarProvider } from "@/components/snackbar-context";
import { SnackbarFromSearchParams } from "@/components/snackbar-from-search-params";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SnackbarProvider>
      <SessionProvider>
        <Suspense fallback={null}>
          <SnackbarFromSearchParams />
        </Suspense>
        {children}
      </SessionProvider>
    </SnackbarProvider>
  );
}
