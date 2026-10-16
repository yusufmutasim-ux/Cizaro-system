import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");

export async function saveUpload(file: File) {
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

function safePath(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("bad key");
  return full;
}

export const readUpload = (key: string) => readFile(safePath(key));
export const removeUpload = (key: string) => unlink(safePath(key)).catch(() => {});

export const MAX_UPLOAD = 50 * 1024 * 1024;
