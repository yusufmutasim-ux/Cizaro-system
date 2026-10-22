"use client";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) location.href = "/";
    else { setErr((await res.json().catch(() => ({}))).error || "Something went wrong"); setBusy(false); }
  }
  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="logo"><span className="logo-mark" /> Studio AI</div>
        <p className="muted" style={{ margin: 0 }}>Your AI ad designer. Enter the password.</p>
        <input className="input" type="password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="error-note">{err}</div>}
        <button className="btn primary" disabled={busy}>Sign in</button>
      </form>
    </main>
  );
}
