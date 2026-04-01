import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-main">
      <div className="login-card">
        <h2>Sign in</h2>
        <p className="login-lead">
          Judges and admins use the same login page; you are routed by role after authentication (PRD §8.3).
        </p>
        <Suspense fallback={<p className="login-lead">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
