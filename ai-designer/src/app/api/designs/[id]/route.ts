import { prisma } from "@/lib/db";
import { route, json, fail, str, type Params } from "@/lib/api";
import { designDTO } from "@/lib/dto";
import { parseLayout, FORMATS } from "@/lib/brand";

// Edits from the design editor: copy, layout, format, favorite
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["title", "headline", "subheadline", "cta", "caption", "hashtags", "placement"] as const) {
    const v = str(b[k], 3000);
    if (v !== undefined) data[k] = v;
  }
  if (typeof b.format === "string" && b.format in FORMATS) data.format = b.format;
  if (b.layout && typeof b.layout === "object") data.layout = JSON.stringify(parseLayout(JSON.stringify(b.layout)));
  if (typeof b.favorite === "boolean") data.favorite = b.favorite;
  return json(designDTO(await prisma.design.update({ where: { id }, data })));
});

// Removed from the board but kept, so the chat that made it can still show it to the designer.
export const DELETE = route<Params>(async (_r, { params }) => {
  const d = await prisma.design.findUnique({ where: { id: (await params).id } });
  if (!d) return fail("Design not found", 404);
  await prisma.design.update({ where: { id: d.id }, data: { archived: true } });
  return json({ ok: true });
});
