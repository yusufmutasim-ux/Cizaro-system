"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./client";

// Tiny stale-while-revalidate cache shared across pages, so switching tabs shows the last data instantly.
const store = new Map<string, unknown>();
const subs = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();

function emit(key: string) { subs.get(key)?.forEach((f) => f()); }

export function setData<T>(key: string, v: T | ((old: T | undefined) => T)) {
  const next = typeof v === "function" ? (v as (o: T | undefined) => T)(store.get(key) as T | undefined) : v;
  store.set(key, next);
  emit(key);
}

export function revalidate<T>(key: string): Promise<T> {
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = api<T>(key).then((d) => { setData(key, d); return d; }).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Cached GET. Renders the last known value immediately, refetches on mount, on focus and every `refresh` ms. */
export function useData<T>(key: string | null, refresh = 0) {
  const data = useSyncExternalStore(
    useCallback((cb: () => void) => {
      if (!key) return () => {};
      if (!subs.has(key)) subs.set(key, new Set());
      subs.get(key)!.add(cb);
      return () => { subs.get(key)!.delete(cb); };
    }, [key]),
    () => (key ? (store.get(key) as T | undefined) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (!key) return;
    revalidate(key).catch(() => {});
    const onFocus = () => revalidate(key).catch(() => {});
    window.addEventListener("focus", onFocus);
    const iv = refresh ? setInterval(() => { if (document.visibilityState === "visible") revalidate(key).catch(() => {}); }, refresh) : undefined;
    return () => { window.removeEventListener("focus", onFocus); clearInterval(iv); };
  }, [key, refresh]);

  return {
    data,
    reload: useCallback(() => (key ? revalidate<T>(key) : Promise.resolve(undefined as T)), [key]),
    mutate: useCallback((v: T | ((old: T | undefined) => T)) => { if (key) setData(key, v); }, [key]),
  };
}
