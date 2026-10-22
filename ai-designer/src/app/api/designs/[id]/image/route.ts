import { prisma } from "@/lib/db";
import { route, json, fail, type Params } from "@/lib/api";
import { readStored, saveUpload, MAX_UPLOAD } from "@/lib/storage";
import { designDTO } from "@/lib/dto";

export const GET = route<Params>(async (_r, { params }) => {
  const d = await prisma.design.findUnique({ where: { id: (await params).id } });
  const buf = d?.imageKey ? await readStored(d.imageKey).catch(() => null) : null;
  if (!buf) return fail("No image", 404);
  const mime = buf[0] === 0x89 ? "image/png" : buf[0] === 0xff ? "image/jpeg" : "image/webp";
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
});

// Attach a visual made elsewhere (when no image tool is connected, or to swap the visual)
export const POST = route<Params>(async (req, { params }) => {
  const d = await prisma.design.findUnique({ where: { id: (await params).id } });
  if (!d) return fail("Design not found", 404);
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.type.match(/^image\/(png|jpeg|webp)$/)) return fail("Upload a PNG, JPG or WEBP image");
  if (file.size > MAX_UPLOAD) return fail("Image is too large");
  // The old file stays on disk: earlier chat turns still show it to the designer.
  const imageKey = await saveUpload(file);
  return json(designDTO(await prisma.design.update({ where: { id: d.id }, data: { imageKey, sourceUrl: null } })));
});
