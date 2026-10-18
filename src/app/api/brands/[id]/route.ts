import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";

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
