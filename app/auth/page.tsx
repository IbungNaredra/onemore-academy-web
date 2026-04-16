"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DIVISIONS, type Division } from "@/lib/divisions";
import { useSnackbar } from "@/components/snackbar-context";

export default function AuthPage() {
  const router = useRouter();
  const { status } = useSession();
  const { showError, showSuccess } = useSnackbar();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [division, setDivision] = useState<Division>(DIVISIONS[0]);
  const [signInPending, setSignInPending] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/me");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="panel auth-page">
        <div className="auth-card">
          <p className="terms-note">Loading…</p>
        </div>
      </main>
    );
  }

  if (status === "authenticated") {
    return (
      <main className="panel auth-page">
        <div className="auth-card">
          <p className="terms-note">Redirecting…</p>
        </div>
      </main>
    );
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInPending(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        showError("Invalid email or password.");
        return;
      }
      showSuccess("Signed in.");
      router.push("/me");
      router.refresh();
    } finally {
      setSignInPending(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      showError("Passwords do not match.");
      return;
    }
    setRegisterPending(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, passwordConfirm, name, division }),
      });
      const data = await r.json();
      if (!r.ok) {
        showError(data.error ?? "Registration failed");
        return;
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        showSuccess("Account created — sign in with your new password.");
        setMode("signin");
        return;
      }
      showSuccess("Welcome — you're signed in.");
      router.push("/me");
      router.refresh();
    } finally {
      setRegisterPending(false);
    }
  }

  return (
    <main className="panel auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <h1 className="auth-title">Account</h1>
          <p className="auth-lead">Garena email only. Sign in if you already registered, or create a new account.</p>
        </header>

        <div className="auth-segment" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            id="tab-signin"
            aria-selected={mode === "signin"}
            aria-controls="panel-signin"
            className="auth-segment__btn"
            disabled={signInPending || registerPending}
            onClick={() => {
              setMode("signin");
              setPasswordConfirm("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            id="tab-register"
            aria-selected={mode === "register"}
            aria-controls="panel-register"
            className="auth-segment__btn"
            disabled={signInPending || registerPending}
            onClick={() => {
              setMode("register");
              setPasswordConfirm("");
            }}
          >
            Create account
          </button>
        </div>

        {mode === "signin" ? (
          <form
            id="panel-signin"
            role="tabpanel"
            aria-labelledby="tab-signin"
            className="auth-form"
            onSubmit={onSignIn}
          >
            <div className="form-field">
              <label htmlFor="signin-email">Email</label>
              <input
                id="signin-email"
                className="admin-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-field">
              <label htmlFor="signin-password">Password</label>
              <input
                id="signin-password"
                className="admin-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className={`cta-btn auth-submit${signInPending ? " form-submit-btn--pending" : ""}`}
              disabled={signInPending}
              aria-busy={signInPending}
            >
              {signInPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form
            id="panel-register"
            role="tabpanel"
            aria-labelledby="tab-register"
            className="auth-form"
            onSubmit={onRegister}
          >
            <div className="form-field">
              <label htmlFor="reg-name">Full name</label>
              <input
                id="reg-name"
                className="admin-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reg-division">Division</label>
              <select
                id="reg-division"
                className="admin-input"
                value={division}
                onChange={(e) => setDivision(e.target.value as Division)}
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                className="admin-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@garena.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reg-password">Password (at least 8 characters)</label>
              <input
                id="reg-password"
                className="admin-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="form-field">
              <label htmlFor="reg-password-confirm">Confirm password</label>
              <input
                id="reg-password-confirm"
                className="admin-input"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className={`cta-btn auth-submit${registerPending ? " form-submit-btn--pending" : ""}`}
              disabled={registerPending}
              aria-busy={registerPending}
            >
              {registerPending ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
