"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Brand } from "./Brand";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  // Remount the form when switching screens so inputs and errors start fresh.
  return <AccountForm key={mode} mode={mode} />;
}

function AccountForm({ mode }: { mode: AuthMode }) {
  const register = mode === "register";
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          ...(register ? { name: data.get("name") } : {}),
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again");
      setBusy(false);
    }
  }

  return (
    <main className="auth-experience">
      <div className="auth-frame">
        <section className="auth-art" aria-label="A little inspiration">
          <div className="auth-art-caption"><span>A LITTLE FOCUS GOES A LONG WAY</span><i aria-hidden="true" /></div>
          <div className="auth-art-copy">
            <p className="auth-art-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
            <h1>Make space.<br />Make<br /><em>progress.</em></h1>
            <p>Big ideas. Small steps. One clear plan.<br />Bring it all together with TaskFlow.</p>
          </div>
        </section>

        <section className="auth-form-side" aria-labelledby="auth-title">
          <div className="auth-top-brand"><Brand /></div>
          <div className="auth-form-content">
            <header className="auth-intro">
              <h2 id="auth-title">{register ? "Your Fresh Start" : "Welcome Back"}</h2>
              <p>{register ? "A little less busywork. A lot more possibility." : "Your plans are waiting. Let’s pick up where you left off."}</p>
            </header>
            <form onSubmit={submit} className="auth-fields">
              {register && (
                <label htmlFor="auth-name">Full name
                  <input id="auth-name" className="auth-input" name="name" autoComplete="name" placeholder="Enter your full name" minLength={2} maxLength={80} required disabled={busy} />
                </label>
              )}
              <label htmlFor="auth-email">Email
                <input id="auth-email" className="auth-input" name="email" type="email" autoComplete="email" placeholder="Enter your email" maxLength={254} required disabled={busy} />
              </label>
              <div className="auth-password-group">
                <label htmlFor="auth-password">Password</label>
                <div className="auth-password-field">
                  <input id="auth-password" className="auth-input" name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Create a password" : "Enter your password"} minLength={8} aria-describedby={register ? "password-hint" : undefined} required disabled={busy} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy}>
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
                {register && <p className="auth-password-hint" id="password-hint">Use at least 8 characters.</p>}
              </div>
              {error && <p className="error auth-error" role="alert">{error}</p>}
              <button className="auth-submit" disabled={busy}>
                {busy ? <><span className="auth-spinner" aria-hidden="true" /> Please wait…</> : register ? "Create Account" : "Sign In"}
              </button>
            </form>
            <p className="auth-security-note"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Your workspace, just for you.</p>
          </div>
          <p className="auth-bottom-switch">
            {register ? "Already have an account?" : "Don’t have an account?"}{" "}
            <Link href={register ? "/login" : "/register"}>{register ? "Sign In" : "Sign Up"}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
