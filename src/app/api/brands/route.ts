import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";

const HEX = /^#[0-9a-fA-F]{6}$/;
const brandSelect = {
  id: true, slug: true, name: true, color: true, sort: true,
  _count: { select: { assets: true } },
  assets: { where: { category: "logo", mime: { startsWith: "image/" } }, select: { id: true }, orderBy: { createdAt: "asc" as const }, take: 1 },
} as const;

export const GET = route(async () => {
  const brands = await prisma.brand.findMany({ select: brandSelect, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  return json(brands.map(({ assets, ...b }) => ({ ...b, logoId: assets[0]?.id ?? null })));
});

export const POST = route(async (_u, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const name = str(b.name, 60)?.trim();
  if (!name) return e("err.brandName");
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
  let slug = base, n = 1;
  while (await prisma.brand.findUnique({ where: { slug } })) slug = `${base}-${++n}`;
  const count = await prisma.brand.count();
  const brand = await prisma.brand.create({ data: { name, slug, color: HEX.test(b.color) ? b.color : "#3b47b0", sort: count } });
  return json({ ...brand, logoId: null, _count: { assets: 0 } }, 201);
}, { manager: true });
