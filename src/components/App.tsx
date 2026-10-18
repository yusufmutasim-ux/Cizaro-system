"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import { TabBar } from "./TabBar";
import { useData } from "@/lib/cache";
import type { User } from "@/lib/client";

type Note = { id: string; readAt: string | null };
type AppCtx = {
  me: User;
  setMe: (u: User) => void;
  query: string;
  setQuery: (q: string) => void;
  newTick: number;
  storageWarning: boolean;
};
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => useContext(Ctx)!;

/**
 * The persistent app frame: top bar, phone tab bar and new-task button stay mounted while pages change,
 * so navigation only swaps the page and the tab bar keeps animating.
 */
export function AppProvider({ me: initial, storageWarning, children }: { me: User; storageWarning: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState(initial);
  const [query, setQuery] = useState("");
  const [newTick, setNewTick] = useState(0);
  const isManager = me.role === "MANAGER";
  const notes = useData<Note[]>(isManager ? "/api/notes" : null, 60000);
  const unread = (notes.data ?? []).filter((n) => !n.readAt).length;

  const active = path.startsWith("/brands") ? "brands" : path.startsWith("/team") ? "team" : path.startsWith("/settings") ? "settings" : "tasks";

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "open" && typeof e.data.url === "string") {
        const u = new URL(e.data.url);
        if (u.origin === location.origin) router.push(u.pathname + u.search + u.hash);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);

  // Warm the other tabs so the first visit is instant too
  useEffect(() => { ["/", "/brands", "/settings", ...(isManager ? ["/team"] : [])].forEach((p) => router.prefetch(p)); }, [router, isManager]);

  const value = useMemo(() => ({ me, setMe, query, setQuery, newTick, storageWarning }), [me, query, newTick, storageWarning]);
  const cur = (k: string) => (active === k ? "page" : undefined);
  const onNew = () => { if (active !== "tasks") router.push("/"); setNewTick((n) => n + 1); };

  return (
    <Ctx.Provider value={value}>
      <div className="topbar-wrap wrap">
        <header className="topbar">
          <Link href="/" className="brand"><img src="/icon.svg" alt="" /><span>Cizaro <small>Studio</small></span></Link>
          <nav className="navlinks">
            <Link href="/" prefetch aria-current={cur("tasks")}>{t("nav.tasks")}</Link>
            <Link href="/brands" prefetch aria-current={cur("brands")}>{t("nav.brands")}</Link>
            {isManager && <Link href="/team" prefetch aria-current={cur("team")}>{t("nav.team")}</Link>}
          </nav>
          {active === "tasks"
            ? <label className="search" htmlFor="q"><I name="search" /><input id="q" type="search" placeholder={t("search.placeholder")} autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            : <span style={{ marginInlineStart: "auto" }} />}
          <Link href="/settings" prefetch className="me-btn" aria-label={t("nav.settings")} aria-current={cur("settings")}>
            <Avatar user={me} className="me" />
            {unread > 0 && <span className="dot-badge">{unread}</span>}
          </Link>
        </header>
      </div>

      <div key={active} className="page-enter">{children}</div>

      <div className="tabbar-wrap">
        <TabBar selected={active} badge={{ settings: unread }} items={[
          { k: "tasks", href: "/", icon: "grid", label: t("nav.tasks") },
          { k: "brands", href: "/brands", icon: "tag", label: t("nav.brands") },
          ...(isManager ? [{ k: "team", href: "/team", icon: "people" as const, label: t("nav.team") }] : []),
          { k: "settings", href: "/settings", icon: "gear", label: t("nav.settings") },
        ]} />
        {active === "tasks" && <button type="button" className="fab" onClick={onNew} aria-label={t("nav.new")}><I name="plus" /></button>}
      </div>
    </Ctx.Provider>
  );
}
