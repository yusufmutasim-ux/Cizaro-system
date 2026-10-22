import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");

function newKey(ext: string) {
  const clean = ext.toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  return `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${clean}`;
}

export async function saveBuffer(buf: Buffer, ext: string) {
  const key = newKey(ext);
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return key;
}

export const saveUpload = async (file: File) => saveBuffer(Buffer.from(await file.arrayBuffer()), path.extname(file.name));

function safePath(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("bad key");
  return full;
}

export const readStored = (key: string) => readFile(safePath(key));
export const removeStored = (key: string) => unlink(safePath(key)).catch(() => {});

export const MAX_UPLOAD = 40 * 1024 * 1024;

const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
export const extForMime = (m: string) => EXT[m] ?? "";

export function mimeFromName(n: string) {
  const ext = n.split(".").pop()?.toLowerCase() ?? "";
  return ({
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
    pdf: "application/pdf", ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
  } as Record<string, string>)[ext] ?? "application/octet-stream";
}

/** Downloads a generated visual so it survives expiring CDN links and can be drawn on a canvas. */
export async function downloadImage(url: string) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_UPLOAD) throw new Error("image too large");
  const type = mime.startsWith("image/") ? mime : sniff(buf);
  if (!type) throw new Error("not an image");
  return { key: await saveBuffer(buf, extForMime(type) || path.extname(new URL(url).pathname)), mime: type, size: buf.length };
}

function sniff(b: Buffer) {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}
