import { prisma } from "@/lib/db";
import { route, json, fail, str } from "@/lib/api";
import { brandDTO } from "@/lib/brands";

export const GET = route(async () => {
  const brands = await prisma.brand.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }], include: brandInclude });
  return json(brands.map(brandDTO));
});

export const POST = route(async (req) => {
  const b = await req.json().catch(() => ({}));
  const name = str(b.name, 60)?.trim();
  if (!name) return fail("Enter a brand name");
  const color = /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#6D5EFC";
  const brand = await prisma.brand.create({ data: { name, color, sort: await prisma.brand.count() }, include: brandInclude });
  return json(brandDTO(brand), 201);
});

const brandInclude = {
  files: { where: { kind: "logo" }, orderBy: { createdAt: "asc" as const }, take: 1 },
  _count: { select: { designs: { where: { archived: false } }, campaigns: true } },
};
