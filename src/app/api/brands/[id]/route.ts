import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { removeUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };
const HEX = /^#[0-9a-fA-F]{6}$/;

export const PATCH = route<Ctx>(async (_u, req, { params }, e) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string } = {};
  if ("name" in b) { const n = str(b.name, 60)?.trim(); if (!n) return e("err.brandName"); data.name = n; }
  if (HEX.test(b.color)) data.color = b.color;
  return json(await prisma.brand.update({ where: { id }, data }));
}, { manager: true });

// Built-in brands are recreated on every start, so they can't be deleted.
const BUILT_IN = ["cizaro", "dym"];

// DELETE /api/brands/:id?moveTo=<brandId> — tasks must be moved to another brand first, so none are lost.
export const DELETE = route<Ctx>(async (_u, req, { params }, e) => {
  const { id } = await params;
  const brand = await prisma.brand.findUnique({ where: { id }, include: { _count: { select: { tasks: true } }, assets: { select: { storageKey: true } } } });
  if (!brand) return e("err.noBrand", 404);
  if (BUILT_IN.includes(brand.slug)) return e("err.builtInBrand", 403);
  const moveTo = new URL(req.url).searchParams.get("moveTo");
  if (brand._count.tasks > 0) {
    if (!moveTo || moveTo === id) return e("err.brandHasTasks", 409, { n: brand._count.tasks });
    const target = await prisma.brand.findUnique({ where: { id: moveTo }, include: { branches: { orderBy: { sort: "asc" }, select: { id: true } } } });
    if (!target) return e("err.noBrand", 404);
    // Tasks land in the target's first branch when it has branches, otherwise in none
    await prisma.task.updateMany({ where: { brandId: id }, data: { brandId: target.id, branchId: target.branches[0]?.id ?? null } });
  }
  await prisma.brand.delete({ where: { id } });
  await Promise.all(brand.assets.map((a) => a.storageKey && removeUpload(a.storageKey)));
  return json({ ok: true, moved: brand._count.tasks });
}, { manager: true });
