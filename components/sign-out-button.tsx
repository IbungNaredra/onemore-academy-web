"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={`btn-ghost${pending ? " form-submit-btn--pending" : ""}`}
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/" });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
