"use client";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (res.ok) { location.href = "/"; return; }
    setErr((await res.json().catch(() => ({}))).error || "حصلت مشكلة. جرّب تاني.");
    setBusy(false);
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <span className="brand-mark">C</span>
        <h1>Cizaro Studio</h1>
        <p>سجّل دخول عشان تشوف تاسكات التصميم</p>
        <div className="inset">
          <input id="email" type="email" dir="ltr" placeholder="الإيميل" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input id="password" type="password" dir="ltr" placeholder="الباسورد" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="err" role="alert">{err}</div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "بيدخل…" : "دخول"}</button>
      </form>
    </main>
  );
}
