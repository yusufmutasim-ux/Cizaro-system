"use client";
import { useState } from "react";
import { useI18n } from "@/components/I18n";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export default function Login() {
  const { t, l } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function setLang(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.locale) document.cookie = `${LOCALE_COOKIE}=${data.locale}; path=/; max-age=31536000; samesite=lax`;
      location.href = "/";
      return;
    }
    setErr(data.error || t("toast.generic"));
    setBusy(false);
  }

  return (
    <main className="auth">
      <form className="auth-card glass" onSubmit={submit}>
        <img className="logo" src="/icon.svg" alt="" />
        <h1>Cizaro Studio</h1>
        <p>{t("login.subtitle")}</p>
        <div className="inset">
          <input id="email" type="email" dir="ltr" placeholder={t("login.email")} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input id="password" type="password" dir="ltr" placeholder={t("login.password")} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="err" role="alert">{err}</div>
        <button className="btn btn-primary" disabled={busy}>{busy ? t("login.busy") : t("login.submit")}</button>
        <div className="lang-switch">
          <button type="button" aria-pressed={l === "ar"} onClick={() => setLang("ar")}>العربية</button>
          <button type="button" aria-pressed={l === "en"} onClick={() => setLang("en")}>English</button>
        </div>
      </form>
    </main>
  );
}
