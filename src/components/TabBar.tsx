"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { I, type IconName } from "./Icons";

type Item = { k: string; label: string; icon: IconName; href?: string; onClick?: () => void };
const KEY = "cz-tab";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Phone tab bar with a liquid glass thumb that slides to the selected tab and squishes as it travels.
 * The last tab is remembered across page loads, so navigating animates from the previous tab.
 */
export function TabBar({ items, selected }: { items: Item[]; selected: string }) {
  const nav = useRef<HTMLElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const at = useRef<string | null>(null);

  const place = useCallback((k: string, animate: boolean) => {
    const el = nav.current?.querySelector<HTMLElement>(`[data-k="${k}"]`);
    const th = thumb.current;
    if (!el || !th) return;
    th.style.transition = animate && !reduced() ? "" : "none";
    const moved = at.current !== null && at.current !== k;
    th.style.translate = `${el.offsetLeft}px 0`;
    th.style.width = `${el.offsetWidth}px`;
    th.style.opacity = "1";
    if (animate && moved && !reduced()) {
      th.animate([{ scale: "1 1" }, { scale: "1.18 0.86", offset: 0.35 }, { scale: "0.96 1.04", offset: 0.7 }, { scale: "1 1" }], { duration: 560, easing: "ease-out" });
    }
    at.current = k;
    try { sessionStorage.setItem(KEY, k); } catch {}
  }, []);

  // First paint: continue from exactly where the previous page's thumb was (even mid-slide), then glide here.
  // Each page renders its own tab bar, so the outgoing one records its live position as it unmounts.
  useLayoutEffect(() => {
    let live: { x: number; w: number; t: number } | null = null;
    let prev: string | null = null;
    try { live = JSON.parse(sessionStorage.getItem(KEY + "-live") || "null"); prev = sessionStorage.getItem(KEY); } catch {}
    const th = thumb.current;
    if (th && live && Date.now() - live.t < 2000 && !reduced()) {
      th.style.transition = "none";
      th.style.translate = `${live.x}px 0`;
      th.style.width = `${live.w}px`;
      th.style.opacity = "1";
      at.current = "__from";
      requestAnimationFrame(() => requestAnimationFrame(() => place(selected, true)));
    } else if (prev && prev !== selected && items.some((x) => x.k === prev)) {
      place(prev, false);
      requestAnimationFrame(() => requestAnimationFrame(() => place(selected, true)));
    } else place(selected, false);
    const navEl = nav.current;
    return () => {
      if (!th || !navEl) return;
      const a = th.getBoundingClientRect(), b = navEl.getBoundingClientRect();
      try { sessionStorage.setItem(KEY + "-live", JSON.stringify({ x: a.left - b.left, w: a.width, t: Date.now() })); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (at.current !== null && at.current !== selected) place(selected, true); }, [selected, place]);

  useEffect(() => {
    const ro = new ResizeObserver(() => at.current && place(at.current, false));
    if (nav.current) ro.observe(nav.current);
    return () => ro.disconnect();
  }, [place]);

  return (
    <nav className="tabbar glass" ref={nav}>
      <span className="tab-thumb" ref={thumb} aria-hidden="true" />
      {items.map((x) => {
        const cur = x.k === selected ? "page" : undefined;
        const content = <><I name={x.icon} />{x.label}</>;
        return x.href
          ? <Link key={x.k} href={x.href} data-k={x.k} aria-current={cur} onClick={() => place(x.k, true)}>{content}</Link>
          : <button key={x.k} type="button" data-k={x.k} aria-current={cur} onClick={() => { place(x.k, true); x.onClick?.(); }}>{content}</button>;
      })}
    </nav>
  );
}
