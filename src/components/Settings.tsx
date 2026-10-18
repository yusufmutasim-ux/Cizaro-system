"use client";
import { useCallback, useEffect, useState } from "react";
import { I } from "./Icons";
import { Avatar } from "./Avatar";
import { useI18n } from "./I18n";
import { Segmented } from "./Motion";
import { api, type User } from "@/lib/client";
import type { Locale } from "@/lib/i18n";

type PushState = "loading" | "unsupported" | "install-first" | "blocked" | "off" | "on";

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function Settings({ me, onClose }: { me: User; onClose: () => void }) {
  const { t, l } = useI18n();
  const [on, setOn] = useState(false);
  const [push, setPush] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [installed, setInstalled] = useState(false);

  const close = useCallback(() => { setOn(false); setTimeout(onClose, 380); }, [onClose]);

  const refresh = useCallback(async () => {
    setInstalled(isStandalone());
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPush(isIOS() && !isStandalone() ? "install-first" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") { setPush("blocked"); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setPush(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setOn(true));
    refresh();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [refresh, close]);

  async function enable() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPush(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await api<{ key: string }>("/api/push");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      await api("/api/push", { method: "POST", json: { ...sub.toJSON(), test: true } });
      setPush("on"); setMsg(t("settings.testSent"));
    } catch (e) {
      setMsg((e as Error).message || t("toast.generic"));
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await api("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setPush("off"); setMsg("");
    } finally { setBusy(false); }
  }

  async function test() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return refresh();
    await api("/api/push", { method: "POST", json: { ...sub.toJSON(), test: true } });
    setMsg(t("settings.testSent"));
  }

  async function setLocale(next: Locale) {
    if (next === l) return;
    await api("/api/me", { method: "PATCH", json: { locale: next } });
    location.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <>
      <div className={`scrim ${on ? "on" : ""}`} onClick={close} />
      <div className={`sheet narrow ${on ? "on" : ""}`} role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <div className="sheet-bar">
          <span className="grab" />
          <div className="ttl" style={{ fontSize: 17 }}>{t("settings.title")}</div>
          <button type="button" className="done-btn" onClick={close}>{t("sheet.done")}</button>
        </div>
        <div className="sheet-body single">
          <div className="main">
            <div className="group">
              <div className="set-row">
                <Avatar user={me} size="lg" />
                <div className="grow"><b>{me.name}</b><small style={{ unicodeBidi: "plaintext" }}>{me.email} · {t(me.role === "MANAGER" ? "team.manager" : "team.designer")}</small></div>
              </div>
            </div>

            <div>
              <div className="group-h"><I name="globe" />{t("settings.language")}</div>
              <Segmented full label={t("settings.language")} value={l} onChange={setLocale}
                options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
            </div>

            <div>
              <div className="group-h"><I name="bell" />{t("settings.notifications")}</div>
              <div className="group">
                <div className="set-row">
                  <div className="grow">
                    {push === "on" ? t("settings.notifOn") : t("settings.notifOff")}
                  </div>
                  {push === "on" && <button type="button" className="btn btn-gray" onClick={test} disabled={busy}>{t("settings.notifTest")}</button>}
                </div>
                <div className="set-row">
                  {push === "on"
                    ? <button type="button" className="btn btn-danger" onClick={disable} disabled={busy}>{t("settings.notifDisable")}</button>
                    : <button type="button" className="btn btn-primary" onClick={enable} disabled={busy || push !== "off"}><I name="bell" />{t("settings.notifEnable")}</button>}
                </div>
              </div>
              {push === "install-first" && <div className="note warn">{t("settings.notifInstallFirst")}</div>}
              {push === "blocked" && <div className="note warn">{t("settings.notifBlocked")}</div>}
              {push === "unsupported" && <div className="note warn">{t("settings.notifUnsupported")}</div>}
              {msg && <div className="note">{msg}</div>}
            </div>

            <div>
              <div className="group-h"><I name="phone" />{t("settings.install")}</div>
              <div className="group">
                {installed
                  ? <div className="set-row"><span style={{ color: "var(--green)", display: "inline-flex" }}><I name="check" /></span><div className="grow">{t("settings.installed")}</div></div>
                  : <>
                      <div className="set-row"><div className="grow"><b>iPhone</b><small>{t("settings.installIos")}</small></div></div>
                      <div className="set-row"><div className="grow"><b>Android</b><small>{t("settings.installAndroid")}</small></div></div>
                    </>}
              </div>
            </div>

            <button type="button" className="btn btn-danger" style={{ height: 46 }} onClick={logout}><I name="out" />{t("settings.logout")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
