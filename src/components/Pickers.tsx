"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I } from "./Icons";
import { useI18n } from "./I18n";
import { intlTag, parseYmd, ymd } from "@/lib/client";

/* Glass popover anchored to a trigger. Rendered in a portal so sheets (which use transforms) can't clip it. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vh = window.innerHeight, vw = window.innerWidth;
    const below = vh - r.bottom - 12, above = r.top - 12;
    const up = below < 260 && above > below;
    const width = Math.min(Math.max(r.width, 220), vw - 24);
    const rtl = document.documentElement.dir === "rtl";
    let left = rtl ? r.right - width : r.left;
    left = Math.max(12, Math.min(left, vw - width - 12));
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left, width, up, maxH: Math.max(160, Math.min(360, up ? above : below)) });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    // Escape closes only this menu, not the sheet underneath: handle it on window (first in line) and stop it there
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); setOpen(false); btn.current?.focus(); } };
    // Page scrolls move the menu with its button; it closes only once the button leaves the screen
    const onScroll = (e: Event) => {
      if (pop.current?.contains(e.target as Node)) return;
      const r = btn.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setOpen(false);
      else place();
    };
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return { open, setOpen, pos, btn, pop };
}

function Pop({ p, children, className = "" }: { p: ReturnType<typeof usePopover>; children: React.ReactNode; className?: string }) {
  if (!p.open || !p.pos || typeof document === "undefined") return null;
  const { top, left, width, up, maxH } = p.pos;
  return createPortal(
    <div ref={p.pop} className={`pop-menu ${up ? "up" : ""} ${className}`} role="presentation"
      style={{ left, width, maxHeight: maxH, ...(up ? { bottom: window.innerHeight - top } : { top }) }}>
      {children}
    </div>,
    document.body,
  );
}

export type Opt = { value: string; label: string; icon?: React.ReactNode; hint?: string; iconOnly?: boolean };

/** Replacement for <select>: a glass button that opens an anchored, keyboard-friendly menu. */
export function Picker({ value, options, onChange, label, variant = "field", placeholder, disabled, id, ltr, footer }: {
  value: string; options: Opt[]; onChange: (v: string) => void; label: string;
  variant?: "field" | "pill"; placeholder?: string; disabled?: boolean; id?: string; ltr?: boolean; footer?: React.ReactNode;
}) {
  const p = usePopover();
  const [hi, setHi] = useState(0);
  const cur = options.find((o) => o.value === value);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p.open) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setHi(idx);
    requestAnimationFrame(() => reveal(idx));
  }, [p.open, options, value]);

  // Scroll only the menu itself. scrollIntoView would also scroll the page, which closes the menu.
  function reveal(idx: number) {
    const box = p.pop.current, el = list.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 6;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 6;
  }

  function choose(v: string) { onChange(v); p.setOpen(false); p.btn.current?.focus(); }
  function onKey(e: React.KeyboardEvent) {
    if (!p.open) { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); p.setOpen(true); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(options.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[hi]) choose(options[hi].value); }
    else if (e.key === "Tab") p.setOpen(false);
  }
  useEffect(() => { if (p.open) reveal(hi); }, [hi, p.open]);

  return (
    <>
      <button ref={p.btn} id={id} type="button" className={`picker ${variant} ${ltr ? "ltr" : ""}`} disabled={disabled} aria-label={label}
        aria-haspopup="listbox" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)} onKeyDown={onKey}>
        {cur?.icon}
        {cur?.iconOnly ? <span className="sr-only">{cur.label}</span> : <span className={cur ? "" : "ph"}>{cur?.label ?? placeholder ?? "—"}</span>}
        <svg className="chev" viewBox="0 0 10 14" aria-hidden="true"><path d="M2 5l3-3 3 3M2 9l3 3 3-3" /></svg>
      </button>
      <Pop p={p}>
        <div ref={list} role="listbox" aria-label={label} className={`pop-list ${ltr ? "ltr" : ""}`}>
          {options.map((o, n) => (
            <button key={o.value} type="button" role="option" data-i={n} aria-selected={o.value === value}
              className={`pop-opt ${n === hi ? "hi" : ""}`} onMouseEnter={() => setHi(n)} onClick={() => choose(o.value)}>
              {o.icon}<span className="grow">{o.iconOnly ? <span className="sr-only">{o.label}</span> : o.label}{o.hint && <small>{o.hint}</small>}</span>
              {o.value === value && <I name="check" className="tick" />}
            </button>
          ))}
        </div>
        {footer && <div className="pop-foot" onClick={() => p.setOpen(false)}>{footer}</div>}
      </Pop>
    </>
  );
}

/** Replacement for <input type="date">: a glass calendar. Value is YYYY-MM-DD or "". */
export function DatePicker({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id?: string }) {
  const { l, t } = useI18n();
  const p = usePopover();
  const base = value ? parseYmd(value) : new Date();
  const [month, setMonth] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1));
  useEffect(() => { if (p.open) { const d = value ? parseYmd(value) : new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); } }, [p.open, value]);

  const tag = intlTag(l);
  const sameYear = value ? parseYmd(value).getFullYear() === new Date().getFullYear() : true;
  const fmtBtn = new Intl.DateTimeFormat(tag, sameYear ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" });
  const weekStart = l === "ar" ? 6 : 0; // Saturday in Egypt, Sunday in English
  const dayNames = Array.from({ length: 7 }, (_, k) => new Intl.DateTimeFormat(tag, { weekday: "narrow" }).format(new Date(2024, 0, 7 + ((weekStart + k) % 7))));
  const first = (month.getDay() - weekStart + 7) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];
  const todayStr = ymd(new Date());
  const pick = (d: number) => { onChange(ymd(new Date(month.getFullYear(), month.getMonth(), d))); p.setOpen(false); };
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <>
      <button ref={p.btn} id={id} type="button" className="picker field" aria-label={label} aria-haspopup="dialog" aria-expanded={p.open} onClick={() => p.setOpen(!p.open)}>
        <span className={value ? "" : "ph"}>{value ? fmtBtn.format(parseYmd(value)) : t("date.none")}</span>
        <svg className="chev" viewBox="0 0 10 14" aria-hidden="true"><path d="M2 5l3-3 3 3M2 9l3 3 3-3" /></svg>
      </button>
      <Pop p={p} className="cal-pop">
        <div className="cal" role="dialog" aria-label={label}>
          <div className="cal-head">
            <button type="button" className="cal-nav" onClick={() => shift(-1)} aria-label={t("date.prev")}><I name="chevL" /></button>
            <b>{fmtMonth.format(month)}</b>
            <button type="button" className="cal-nav" onClick={() => shift(1)} aria-label={t("date.next")}><I name="chevR" /></button>
          </div>
          <div className="cal-grid">
            {dayNames.map((d, k) => <span key={"h" + k} className="cal-dn">{d}</span>)}
            {cells.map((d, k) => {
              if (!d) return <span key={k} />;
              const s = ymd(new Date(month.getFullYear(), month.getMonth(), d));
              return <button key={k} type="button" className={`cal-d ${s === value ? "on" : ""} ${s === todayStr ? "today" : ""}`} onClick={() => pick(d)}>{d}</button>;
            })}
          </div>
          <div className="cal-foot">
            <button type="button" className="btn btn-tinted" onClick={() => { onChange(todayStr); p.setOpen(false); }}>{t("date.today")}</button>
            <button type="button" className="btn btn-tinted" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); onChange(ymd(d)); p.setOpen(false); }}>{t("date.tomorrow")}</button>
            {value && <button type="button" className="btn btn-gray" onClick={() => { onChange(""); p.setOpen(false); }}>{t("date.clear")}</button>}
          </div>
        </div>
      </Pop>
    </>
  );
}
