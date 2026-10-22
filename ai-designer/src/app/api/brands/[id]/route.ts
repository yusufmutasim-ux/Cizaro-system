import { prisma } from "@/lib/db";
import { route, json, fail, str, type Params } from "@/lib/api";
import { brandDTO } from "@/lib/brands";
import { parseBook } from "@/lib/brand";
import { removeStored } from "@/lib/storage";

const include = { files: { where: { kind: "logo" }, orderBy: { createdAt: "asc" as const }, take: 1 }, _count: { select: { designs: { where: { archived: false } }, campaigns: true } } };

export const GET = route<Params>(async (_r, { params }) => {
  const b = await prisma.brand.findUnique({ where: { id: (await params).id }, include });
  return b ? json(brandDTO(b)) : fail("Brand not found", 404);
});

// { name?, color?, book? } — book is the whole brand book
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string; book?: string } = {};
  if ("name" in b) { const n = str(b.name, 60)?.trim(); if (!n) return fail("Enter a brand name"); data.name = n; }
  if (/^#[0-9a-fA-F]{6}$/.test(b.color)) data.color = b.color;
  if (b.book && typeof b.book === "object") data.book = JSON.stringify(parseBook(JSON.stringify(b.book)));
  return json(brandDTO(await prisma.brand.update({ where: { id }, data, include })));
});

export const DELETE = route<Params>(async (_r, { params }) => {
  const { id } = await params;
  const [files, designs] = await Promise.all([
    prisma.brandFile.findMany({ where: { brandId: id }, select: { storageKey: true } }),
    prisma.design.findMany({ where: { brandId: id }, select: { imageKey: true } }),
  ]);
  await prisma.brand.delete({ where: { id } });
  await Promise.all([...files.map((f) => removeStored(f.storageKey)), ...designs.map((d) => d.imageKey && removeStored(d.imageKey))]);
  return json({ ok: true });
});
