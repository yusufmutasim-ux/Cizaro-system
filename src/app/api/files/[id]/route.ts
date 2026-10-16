import { prisma } from "@/lib/db";
import { route, json, fail } from "@/lib/api";
import { readUpload, removeUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };
const INLINE = /^(image\/(png|jpeg|gif|webp|svg\+xml)|video\/(mp4|webm)|application\/pdf)$/;

export const GET = route<Ctx>(async (_u, _r, { params }) => {
  const f = await prisma.file.findUnique({ where: { id: (await params).id } });
  if (!f || !f.storageKey) return fail("الملف مش موجود", 404);
  const buf = await readUpload(f.storageKey).catch(() => null);
  if (!buf) return fail("الملف مش موجود", 404);
  const mime = f.mime || "application/octet-stream";
  const inline = INLINE.test(mime);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": inline ? mime : "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

export const DELETE = route<Ctx>(async (user, _r, { params }) => {
  const f = await prisma.file.findUnique({ where: { id: (await params).id } });
  if (!f) return json({ ok: true });
  if (f.uploadedById !== user.id && user.role !== "MANAGER") return fail("تقدر تشيل الملفات اللي انت رفعتها بس", 403);
  await prisma.file.delete({ where: { id: f.id } });
  if (f.storageKey) await removeUpload(f.storageKey);
  const task = await prisma.task.findUnique({ where: { id: f.taskId }, select: { coverFileId: true } });
  if (task?.coverFileId === f.id) {
    const next = await prisma.file.findFirst({ where: { taskId: f.taskId, slot: "delivery", mime: { startsWith: "image/" } }, orderBy: { createdAt: "desc" } });
    await prisma.task.update({ where: { id: f.taskId }, data: { coverFileId: next?.id ?? null } });
  }
  return json({ ok: true });
});
