"use client";
import type { BrandBook, Layout } from "./brand";
import type { DesignDTO, CampaignDTO } from "./dto";
import type { FileDTO, BrandDTO } from "./brands";

export type { BrandBook, Layout, DesignDTO, CampaignDTO, FileDTO, BrandDTO };
export type ChatSummary = { id: string; title: string; updatedAt: string };
export type ChatView = { role: "user" | "assistant"; text: string; images: string[]; tools: string[]; designIds: string[] };

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { location.href = "/login"; throw new Error(data.error || "401"); }
  if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
  return data as T;
}

export async function upload(brandId: string, kind: string, files: FileList | File[]) {
  const fd = new FormData();
  fd.set("kind", kind);
  [...files].forEach((f) => fd.append("file", f));
  return api<FileDTO[]>(`/api/brands/${brandId}/files`, { method: "POST", body: fd });
}

export const kb = (n?: number | null) => (!n ? "" : n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

export async function copyText(v: string) {
  try { await navigator.clipboard.writeText(v); return true; } catch { return false; }
}

const rtf = new Intl.RelativeTimeFormat("ar-EG-u-nu-latn", { numeric: "auto" });
export function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000, a = Math.abs(s);
  if (a < 45) return "دلوقتي";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
