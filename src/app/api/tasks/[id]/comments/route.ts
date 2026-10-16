import { prisma } from "@/lib/db";
import { route, json, fail, str } from "@/lib/api";
import { addActivity } from "@/lib/tasks";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (user, req, { params }) => {
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const text = str(b.text)?.trim();
  if (!text) return fail("التعليق فاضي");
  if (!(await prisma.task.findUnique({ where: { id }, select: { id: true } }))) return fail("التاسك مش موجود", 404);
  await addActivity(id, user.id, "comment", { text });
  await prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });
  return json({ ok: true }, 201);
});
