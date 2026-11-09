"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { Brand } from "./Brand";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ ...(register ? { name: data.get("name") } : {}), email: data.get("email"), password: data.get("password") }) });
      router.replace("/dashboard"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again"); setBusy(false); }
  }
  return <main className="auth-shell">
    <section className="auth-story"><Brand /><div><p className="eyebrow">LESS BUSYWORK. MORE MOMENTUM.</p><h1>Good work<br />starts with<br /><em>a clear plan.</em></h1><p>One focused space for your tasks, ideas, and everything you’re moving forward.</p><div className="story-board" aria-hidden="true"><span>To Do <b>3</b></span><span>In Progress <b>2</b></span><span>Done <b>5</b></span><div>Outline the next big idea</div><div className="story-active">Make it happen ↗</div><div>✓ Celebrate the small wins</div></div></div><small>Built for a little more flow, every day.</small></section>
    <section className="auth-panel"><div className="auth-card"><div className="mobile-brand"><Brand /></div><p className="eyebrow">YOUR WORK, IN FLOW</p><h2>{register ? "A fresh start awaits." : "Welcome back."}</h2><p className="muted">{register ? "Create your account and turn plans into progress." : "Pick up where you left off. Let’s make progress."}</p>
    <form onSubmit={submit} className="stack">
      {register && <label>Full name<input name="name" autoComplete="name" placeholder="Alex Morgan" minLength={2} maxLength={80} required disabled={busy} /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required disabled={busy} /></label>
      <label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "At least 8 characters" : "Enter your password"} minLength={8} required disabled={busy} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : register ? "Create account →" : "Log in →"}</button>
    </form><p className="auth-switch">{register ? "Already have an account?" : "New to TaskFlow?"} <Link href={register ? "/login" : "/register"}>{register ? "Log in" : "Create an account"}</Link></p>
    <p className="auth-note">A clearer head. A better day. A task at a time.</p></div></section>
  </main>;
}
