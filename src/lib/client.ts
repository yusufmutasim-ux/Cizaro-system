"use client";
import type { Locale } from "./i18n";

export type User = { id: string; name: string; email: string; role: "MANAGER" | "DESIGNER"; active?: boolean; locale?: Locale; avatarAt?: string | null; leadId?: string | null; branchId?: string | null };
export type Task = {
  id: number; title: string; brief: string; type: string; size: string; due: string | null; priority: string; status: string;
  revisions: number; coverFileId: string | null; brandId: string | null; branchId: string | null; assigneeId: string | null; createdById: string; createdAt: string; updatedAt: string;
  _count: { files: number; activity: number };
};
export type Branch = { id: string; slug: string; name: string; nameEn: string; code: string };
export type Brand = { id: string; slug: string; name: string; color: string; logoId: string | null; branches?: Branch[]; _count?: { assets: number; tasks?: number } };
export type Upcoming = { id: string; title: string; note: string; date: string | null; brandId: string | null; branchId: string | null; createdById: string; createdAt: string };
export type BrandAsset = { id: string; brandId: string; category: string; name: string; value: string | null; mime: string | null; size: number | null; hasFile: boolean; uploadedById: string; createdAt: string };
export type Activity = { id: string; userId: string | null; kind: string; text: string | null; toStatus: string | null; round: number | null; createdAt: string };
export type FileRow = { id: string; slot: string; kind: string; name: string; href: string; mime: string | null; size: number | null; uploadedById: string; createdAt: string; pending?: boolean };

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { location.href = "/login"; throw new Error(data.error || "401"); }
  if (!res.ok) throw new Error(data.error || String(res.status));
  return data as T;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const dayDiff = (s: string) => Math.round((parseYmd(s).getTime() - parseYmd(today()).getTime()) / 864e5);
export const isOpen = (t: Task) => t.status !== "done";
export const kb = (n?: number | null) => (!n ? "" : n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

export const intlTag = (l: Locale) => (l === "ar" ? "ar-EG-u-nu-latn" : "en-US");

const PALETTE = ["#3b47b0", "#af52de", "#ff9500", "#28cd41", "#ff2d55", "#5856d6", "#00a6a6", "#a2845e"];
export function colorFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Everyone below `id` in the reporting tree, from the users list. Mirrors the server rule. */
export function subordinatesOf(id: string, users: User[]): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next = users.filter((u) => u.leadId && frontier.includes(u.leadId) && !out.has(u.id)).map((u) => u.id);
    next.forEach((x) => out.add(x));
    frontier = next;
  }
  return out;
}
