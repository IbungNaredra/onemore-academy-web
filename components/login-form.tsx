"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "@/components/snackbar-context";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/me";
  const { showError } = useSnackbar();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        showError("Invalid email or password.");
        return;
      }
      window.location.href = res?.url ?? callbackUrl;
    } catch {
      showError("Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button
        className={`btn-primary${pending ? " form-submit-btn--pending" : ""}`}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
