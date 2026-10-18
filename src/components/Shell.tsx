"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import Settings from "./Settings";
import type { User } from "@/lib/client";

type Props = {
  me: User;
  active: "tasks" | "team" | "brands";
  search?: React.ReactNode;
  onNew?: () => void;
  children: React.ReactNode;
};

export function Shell({ me, active, search, onNew, children }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "open" && typeof e.data.url === "string") {
        const u = new URL(e.data.url);
        if (u.origin === location.origin) router.push(u.pathname + u.search);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);

  const cur = (k: string) => (active === k ? "page" : undefined);

  return (
    <>
      <div className="topbar-wrap wrap">
        <header className="topbar">
          <Link href="/" className="brand"><img src="/icon.svg" alt="" /><span>Cizaro <small>Studio</small></span></Link>
          <nav className="navlinks">
            <Link href="/" aria-current={cur("tasks")}>{t("nav.tasks")}</Link>
            <Link href="/brands" aria-current={cur("brands")}>{t("nav.brands")}</Link>
            {me.role === "MANAGER" && <Link href="/team" aria-current={cur("team")}>{t("nav.team")}</Link>}
          </nav>
          {search ?? <span style={{ marginInlineStart: "auto" }} />}
          <button type="button" className="me-btn" onClick={() => setSettings(true)} aria-label={t("nav.settings")}>
            <Avatar user={me} className="me" />
          </button>
        </header>
      </div>

      {children}

      <div className="tabbar-wrap">
        <nav className="tabbar glass">
          <Link href="/" aria-current={cur("tasks")}><I name="grid" />{t("nav.tasks")}</Link>
          <Link href="/brands" aria-current={cur("brands")}><I name="tag" />{t("nav.brands")}</Link>
          {me.role === "MANAGER" && <Link href="/team" aria-current={cur("team")}><I name="people" />{t("nav.team")}</Link>}
          <button type="button" onClick={() => setSettings(true)}><I name="gear" />{t("nav.settings")}</button>
        </nav>
        {onNew && <button type="button" className="fab" onClick={onNew} aria-label={t("nav.new")}><I name="plus" /></button>}
      </div>

      {settings && <Settings me={me} onClose={() => setSettings(false)} />}
    </>
  );
}
