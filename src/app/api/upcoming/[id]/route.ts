import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { upcomingSelect, readFields } from "@/lib/upcoming";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (_u, req, { params }, e) => {
  const { id } = await params;
  if (!(await prisma.upcoming.findUnique({ where: { id }, select: { id: true } }))) return e("err.noUpcoming", 404);
  const f = await readFields(await req.json().catch(() => ({})), true);
  if ("error" in f) return e(f.error, f.error === "err.noBrand" ? 404 : 400);
  return json(await prisma.upcoming.update({ where: { id }, data: f, select: upcomingSelect }));
}, { manager: true });

export const DELETE = route<Ctx>(async (_u, _r, { params }) => {
  await prisma.upcoming.deleteMany({ where: { id: (await params).id } });
  return json({ ok: true });
}, { manager: true });
