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
    else { setErr((await res.json().catch(() => ({}))).error || "حصلت مشكلة"); setBusy(false); }
  }
  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="logo"><span className="logo-mark" /> Studio AI</div>
        <p className="muted" style={{ margin: 0 }}>مصمم الإعلانات بتاعك. ادخل الباسورد.</p>
        <input className="input" type="password" autoFocus placeholder="الباسورد" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="error-note">{err}</div>}
        <button className="btn primary" disabled={busy}>دخول</button>
      </form>
    </main>
  );
}
