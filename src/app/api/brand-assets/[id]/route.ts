import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { readUpload, removeUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };
const INLINE = /^(image\/(png|jpeg|gif|webp|svg\+xml)|video\/(mp4|webm)|application\/pdf|font\/(ttf|otf|woff2?))$/;

// ?download=1 forces a download; otherwise images, PDFs and fonts are served inline (fonts so the kit can preview them)
export const GET = route<Ctx>(async (_u, req, { params }, e) => {
  const a = await prisma.brandAsset.findUnique({ where: { id: (await params).id } });
  if (!a?.storageKey) return e("err.noFile", 404);
  const buf = await readUpload(a.storageKey).catch(() => null);
  if (!buf) return e("err.noFile", 404);
  const mime = a.mime || "application/octet-stream";
  const inline = INLINE.test(mime) && !new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": INLINE.test(mime) ? mime : "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; font-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

export const DELETE = route<Ctx>(async (_u, _r, { params }) => {
  const a = await prisma.brandAsset.findUnique({ where: { id: (await params).id } });
  if (a) {
    await prisma.brandAsset.delete({ where: { id: a.id } });
    if (a.storageKey) await removeUpload(a.storageKey);
  }
  return json({ ok: true });
}, { manager: true });
