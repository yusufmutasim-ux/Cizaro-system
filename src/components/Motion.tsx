"use client";
import { useLayoutEffect, useRef, useState } from "react";

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * FLIP animation for items marked with data-flip="<id>" inside the returned container ref.
 * When `key` changes (items moved, added or removed), each item glides from where it was to
 * where it is now, and new items scale in. Positions are measured relative to the container so
 * page and board scrolling don't register as movement.
 */
export function useFlip<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const prev = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) { prev.current = null; return; }
    const base = root.getBoundingClientRect();
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const r = el.getBoundingClientRect();
      next.set(el.dataset.flip!, new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height));
    });
    const old = prev.current;
    if (old && !reduced()) {
      root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
        const id = el.dataset.flip!, now = next.get(id)!, was = old.get(id);
        if (!was) {
          el.animate([{ opacity: 0, transform: "scale(.92) translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: SPRING });
          return;
        }
        const dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(1.02)`, zIndex: 5 }, { transform: "none", zIndex: 5 }],
          { duration: 520, easing: SPRING },
        );
      });
    }
    prev.current = next;
  }, [key]);

  return ref;
}

type Opt<V extends string> = { value: V; label: React.ReactNode };

/** Segmented control whose selection is a glass thumb that slides between options. */
export function Segmented<V extends string>({ options, value, onChange, label, full, className = "" }: {
  options: Opt<V>[]; value: V; onChange: (v: V) => void; label: string; full?: boolean; className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const btn = el.querySelector<HTMLElement>(`[data-v="${CSS.escape(value)}"]`);
      if (btn) setThumb({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);

  return (
    <div ref={wrap} className={`seg glass slide ${full ? "full" : ""} ${className}`} role="tablist" aria-label={label}>
      {thumb && <span className={`thumb ${ready ? "ready" : ""}`} style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} />}
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" data-v={o.value} aria-selected={value === o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
