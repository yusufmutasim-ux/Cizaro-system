"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { I } from "./Icons";
import { Avatar } from "./Avatar";
import { useI18n } from "./I18n";
import { useApp } from "./App";
import { Segmented } from "./Motion";
import { useData } from "@/lib/cache";
import { api, type User } from "@/lib/client";
import type { Key, Locale } from "@/lib/i18n";

type PushState = "loading" | "unsupported" | "install-first" | "blocked" | "off" | "on";
type Me = User & { notifyPrefs: Record<string, boolean> };
type Note = { id: string; fromId: string; text: string; readAt: string | null; createdAt: string };

const KINDS_DESIGNER = ["assigned", "changes", "approved", "comment"] as const;
const KINDS_MANAGER = ["review", "note", "comment", "assigned"] as const;

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Center-crops and shrinks a photo to a 320px square before upload, so avatars stay small and fast. */
async function squarePhoto(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height), size = 320;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.88));
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!on)}><span /></button>;
}

export default function SettingsPage() {
  const i = useI18n();
  const { t, l } = i;
  const { me, setMe } = useApp();
  const isManager = me.role === "MANAGER";
  const meQ = useData<Me>("/api/me");
  const usersQ = useData<User[]>("/api/users");
  const notesQ = useData<Note[]>("/api/notes", 60000);
  const userById = Object.fromEntries((usersQ.data ?? []).map((u) => [u.id, u]));
  const [name, setName] = useState(me.name);
  const [pass, setPass] = useState({ current: "", next: "" });
  const [note, setNote] = useState("");
  const [push, setPush] = useState<PushState>("loading");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [installed, setInstalled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2400); }, []);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { say((e as Error).message || t("toast.generic")); } finally { setBusy(""); }
  };

  const refreshPush = useCallback(async () => {
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
  useEffect(() => { refreshPush(); }, [refreshPush]);

  // Opening a "note" notification lands on #notes
  useEffect(() => { if (location.hash === "#notes") setTimeout(() => document.getElementById("notes")?.scrollIntoView({ behavior: "smooth" }), 300); }, []);

  const saveMe = (patch: Record<string, unknown>) => api<Me>("/api/me", { method: "PATCH", json: patch }).then((u) => { meQ.mutate(u); setMe({ ...me, ...u }); return u; });

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    await run("photo", async () => {
      const fd = new FormData();
      fd.set("file", new File([await squarePhoto(f)], "avatar.jpg", { type: "image/jpeg" }));
      const r = await api<{ avatarAt: string }>("/api/me/avatar", { method: "POST", body: fd });
      setMe({ ...me, avatarAt: r.avatarAt });
      usersQ.reload();
      say(t("set.saved"));
    });
  }

  async function removePhoto() {
    await run("photo", async () => {
      await api("/api/me/avatar", { method: "DELETE" });
      setMe({ ...me, avatarAt: null });
      usersQ.reload();
    });
  }

  async function enablePush() {
    await run("push", async () => {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPush(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await api<{ key: string }>("/api/push");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      await api("/api/push", { method: "POST", json: { ...sub.toJSON(), test: true } });
      setPush("on"); say(t("settings.testSent"));
    });
  }
  async function disablePush() {
    await run("push", async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await api("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setPush("off");
    });
  }
  async function testPush() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return refreshPush();
    await api("/api/push", { method: "POST", json: { ...sub.toJSON(), test: true } });
    say(t("settings.testSent"));
  }

  async function setLocale(next: Locale) {
    if (next === l) return;
    await saveMe({ locale: next });
    location.reload();
  }

  const prefs = meQ.data?.notifyPrefs ?? {};
  const kinds = isManager ? KINDS_MANAGER : KINDS_DESIGNER;
  const notes = notesQ.data ?? [];
  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <main className="wrap settings-page">
      <section className="head"><div><h1>{t("settings.title")}</h1></div></section>

      <div className="settings-grid">
        <div className="settings-col">
          {/* Profile */}
          <section className="group glass profile-card">
            <div className="profile-photo">
              <Avatar user={me} className="av" size="xl" />
              <button type="button" className="photo-btn" onClick={() => fileRef.current?.click()} aria-label={t("set.changePhoto")} disabled={busy === "photo"}><I name="photo" /></button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/heic" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className="profile-meta">
              <b>{me.name}</b>
              <small>{me.email} · {t(isManager ? "team.manager" : "team.designer")}</small>
              <div className="profile-acts">
                <button type="button" className="btn btn-gray" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>{t("set.changePhoto")}</button>
                {me.avatarAt && <button type="button" className="btn btn-danger" onClick={removePhoto} disabled={busy === "photo"}>{t("set.removePhoto")}</button>}
              </div>
            </div>
          </section>

          <form className="group set-form" onSubmit={(e) => { e.preventDefault(); run("name", async () => { await saveMe({ name }); usersQ.reload(); say(t("set.saved")); }); }}>
            <label className="set-label" htmlFor="s-name">{t("set.name")}</label>
            <div className="set-inline">
              <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <button className="btn btn-primary" disabled={busy === "name" || !name.trim() || name.trim() === me.name}>{t("set.save")}</button>
            </div>
          </form>

          {/* Note to manager / team inbox */}
          <section id="notes">
            <div className="group-h"><I name="doc" />{isManager ? t("set.inbox") : t("set.noteTitle")}{isManager && unread > 0 && <span className="pill-badge">{t("set.unread", { n: unread })}</span>}</div>
            {!isManager && (
              <form className="group set-form" onSubmit={(e) => { e.preventDefault(); run("note", async () => { await api("/api/notes", { method: "POST", json: { text: note } }); setNote(""); notesQ.reload(); say(t("set.noteSent")); }); }}>
                <p className="note" style={{ padding: 0 }}>{t("set.noteHint")}</p>
                <textarea id="s-note" className="set-textarea" placeholder={t("set.notePh")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
                <button className="btn btn-primary" disabled={busy === "note" || !note.trim()}><I name="up" />{t("set.noteSend")}</button>
              </form>
            )}
            {(isManager || notes.length > 0) && (
              <div className="group notes-list">
                {!isManager && <div className="list-sec">{t("set.mySent")}</div>}
                {notes.length === 0 && <div className="files-empty">{t("set.inboxEmpty")}</div>}
                {notes.map((n) => {
                  const from = userById[n.fromId];
                  return (
                    <div key={n.id} className={`note-row ${isManager && !n.readAt ? "unread" : ""}`}>
                      {isManager && <Avatar user={from} size="lg" />}
                      <div className="grow">
                        <div className="note-head">{isManager && <b>{from?.name ?? t("activity.formerMember")}</b>}<span>{i.ago(n.createdAt)}</span></div>
                        <div className="note-text">{n.text}</div>
                        {!isManager && <small className={n.readAt ? "seen" : ""}>{n.readAt ? t("set.seen") : t("set.notSeen")}</small>}
                      </div>
                      {isManager && (
                        <button type="button" className="btn btn-gray" onClick={() => run(n.id, async () => {
                          notesQ.mutate((ns) => (ns ?? []).map((x) => (x.id === n.id ? { ...x, readAt: n.readAt ? null : new Date().toISOString() } : x)));
                          await api(`/api/notes/${n.id}`, { method: "PATCH", json: { read: !n.readAt } });
                        })}>{n.readAt ? t("set.markUnread") : t("set.markRead")}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="settings-col">
          {/* Notifications */}
          <section>
            <div className="group-h"><I name="bell" />{t("settings.notifications")}</div>
            <div className="group">
              <div className="set-row">
                <div className="grow">{push === "on" ? t("settings.notifOn") : t("settings.notifOff")}</div>
                {push === "on"
                  ? <><button type="button" className="btn btn-gray" onClick={testPush}>{t("settings.notifTest")}</button><button type="button" className="btn btn-danger" onClick={disablePush} disabled={busy === "push"}>{t("settings.notifDisable")}</button></>
                  : <button type="button" className="btn btn-primary" onClick={enablePush} disabled={busy === "push" || push !== "off"}><I name="bell" />{t("settings.notifEnable")}</button>}
              </div>
              <div className="list-sec">{t("set.notifyWhat")}</div>
              {kinds.map((k) => (
                <div key={k} className="set-row">
                  <div className="grow">{t(`set.n.${k}` as Key)}</div>
                  <Switch label={t(`set.n.${k}` as Key)} on={prefs[k] !== false} disabled={!meQ.data}
                    onChange={(v) => { meQ.mutate({ ...meQ.data!, notifyPrefs: { ...prefs, [k]: v } }); saveMe({ notifyPrefs: { ...prefs, [k]: v } }).catch((e) => say(e.message)); }} />
                </div>
              ))}
            </div>
            {push === "install-first" && <div className="note warn">{t("settings.notifInstallFirst")}</div>}
            {push === "blocked" && <div className="note warn">{t("settings.notifBlocked")}</div>}
            {push === "unsupported" && <div className="note warn">{t("settings.notifUnsupported")}</div>}
          </section>

          <section>
            <div className="group-h"><I name="globe" />{t("settings.language")}</div>
            <Segmented full label={t("settings.language")} value={l} onChange={setLocale} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
          </section>

          <form onSubmit={(e) => { e.preventDefault(); run("pass", async () => { await saveMe({ currentPassword: pass.current, newPassword: pass.next }); setPass({ current: "", next: "" }); say(t("set.passChanged")); }); }}>
            <div className="group-h"><I name="person" />{t("set.password")}</div>
            <div className="inset">
              <input id="s-cur" type="password" dir="ltr" autoComplete="current-password" placeholder={t("set.currentPass")} value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} />
              <input id="s-new" type="password" dir="ltr" autoComplete="new-password" placeholder={t("set.newPass")} value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} minLength={8} />
            </div>
            <button className="btn btn-gray" style={{ marginTop: 10 }} disabled={busy === "pass" || !pass.current || pass.next.length < 8}>{t("set.changePass")}</button>
          </form>

          <section>
            <div className="group-h"><I name="phone" />{t("settings.install")}</div>
            <div className="group">
              {installed
                ? <div className="set-row"><span style={{ color: "var(--green)", display: "inline-flex" }}><I name="check" /></span><div className="grow">{t("settings.installed")}</div></div>
                : <>
                    <div className="set-row"><div className="grow"><b>iPhone</b><small>{t("settings.installIos")}</small></div></div>
                    <div className="set-row"><div className="grow"><b>Android</b><small>{t("settings.installAndroid")}</small></div></div>
                  </>}
            </div>
          </section>

          <button type="button" className="btn btn-danger" style={{ height: 48, width: "100%" }} onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }}>
            <I name="out" />{t("settings.logout")}
          </button>
          <div className="note" style={{ textAlign: "center" }}>Cizaro Studio · {t("set.version")} 1.4</div>
        </div>
      </div>
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}
