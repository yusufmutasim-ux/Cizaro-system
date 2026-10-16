"use client";

export type User = { id: string; name: string; email: string; role: "MANAGER" | "DESIGNER"; active?: boolean };
export type Task = {
  id: number; title: string; brief: string; type: string; size: string; due: string | null; priority: string; status: string;
  revisions: number; coverFileId: string | null; assigneeId: string | null; createdById: string; createdAt: string; updatedAt: string;
  _count: { files: number; activity: number };
};
export type Activity = { id: string; userId: string | null; kind: string; text: string | null; toStatus: string | null; round: number | null; createdAt: string };
export type FileRow = { id: string; slot: string; kind: string; name: string; href: string; mime: string | null; size: number | null; uploadedById: string; createdAt: string; pending?: boolean };

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) { location.href = "/login"; throw new Error("سجّل دخول الأول"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حصلت مشكلة. جرّب تاني.");
  return data as T;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const dayDiff = (s: string) => Math.round((parseYmd(s).getTime() - parseYmd(today()).getTime()) / 864e5);
const fmtDay = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
export const fmtLong = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });
const rtf = new Intl.RelativeTimeFormat("ar-EG-u-nu-latn", { numeric: "auto" });

export const isOpen = (t: Task) => t.status !== "done";

export function dueInfo(t: Task) {
  if (!t.due) return null;
  const d = dayDiff(t.due);
  const label = d === 0 ? "النهارده" : d === 1 ? "بكرة" : d === -1 ? "إمبارح" : fmtDay.format(parseYmd(t.due));
  let cls = "";
  if (isOpen(t)) cls = d < 0 ? "late" : d <= 1 ? "soon" : "";
  return { label, cls, d };
}

export function ago(iso: string) {
  const ts = new Date(iso).getTime();
  const s = (ts - Date.now()) / 1000, a = Math.abs(s);
  if (a < 45) return "دلوقتي";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 604800) return rtf.format(Math.round(s / 86400), "day");
  return fmtDay.format(new Date(ts));
}

export const kb = (n?: number | null) => (!n ? "" : n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

const PALETTE = ["#0071e3", "#af52de", "#ff9500", "#28cd41", "#ff2d55", "#5856d6", "#00a6a6", "#a2845e"];
export function colorFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
