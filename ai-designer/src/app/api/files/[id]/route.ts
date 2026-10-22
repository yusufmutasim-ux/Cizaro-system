import { prisma } from "@/lib/db";
import { route, json, fail, type Params } from "@/lib/api";
import { readStored, removeStored } from "@/lib/storage";

const INLINE = /^(image\/(png|jpeg|gif|webp|svg\+xml)|application\/pdf|font\/(ttf|otf|woff2?))$/;

export const GET = route<Params>(async (req, { params }) => {
  const f = await prisma.brandFile.findUnique({ where: { id: (await params).id } });
  const buf = f && (await readStored(f.storageKey).catch(() => null));
  if (!f || !buf) return fail("File not found", 404);
  const inline = INLINE.test(f.mime) && !new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": INLINE.test(f.mime) ? f.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; font-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

// Chat attachments stay: the conversation history still refers to them.
export const DELETE = route<Params>(async (_r, { params }) => {
  const f = await prisma.brandFile.findUnique({ where: { id: (await params).id } });
  if (f && f.kind !== "attachment") {
    await prisma.brandFile.delete({ where: { id: f.id } });
    await removeStored(f.storageKey);
  }
  return json({ ok: true });
});
