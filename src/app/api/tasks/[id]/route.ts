import { prisma } from "@/lib/db";
import { route, json, fail, str } from "@/lib/api";
import { taskSelect } from "@/lib/tasks";
import { removeUpload } from "@/lib/storage";
import { PRIORITY, TYPES } from "@/lib/vocab";

type Ctx = { params: Promise<{ id: string }> };
const tid = async (ctx: Ctx) => Number((await ctx.params).id);

export const GET = route<Ctx>(async (_u, _r, ctx) => {
  const id = await tid(ctx);
  const task = await prisma.task.findUnique({ where: { id }, select: taskSelect });
  if (!task) return fail("التاسك مش موجود", 404);
  const [activity, files] = await Promise.all([
    prisma.activity.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.file.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  return json({ task, activity, files: files.map(({ storageKey, ...f }) => ({ ...f, href: f.kind === "link" ? f.url : `/api/files/${f.id}` })) });
});

export const PATCH = route<Ctx>(async (_u, req, ctx) => {
  const id = await tid(ctx);
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("title" in b) { const t = str(b.title, 200)?.trim(); if (!t) return fail("اسم التاسك مينفعش يبقى فاضي"); data.title = t; }
  if ("brief" in b) data.brief = str(b.brief) ?? "";
  if ("type" in b && TYPES.includes(b.type)) data.type = b.type;
  if ("size" in b) data.size = str(b.size, 40)?.trim() ?? "";
  if ("due" in b) data.due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  if ("priority" in b && b.priority in PRIORITY) data.priority = b.priority;
  if ("assigneeId" in b) {
    const a = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
    if (a && !(await prisma.user.findUnique({ where: { id: a } }))) return fail("المصمم مش موجود");
    data.assigneeId = a;
  }
  const task = await prisma.task.update({ where: { id }, data, select: taskSelect });
  return json(task);
});

export const DELETE = route<Ctx>(async (_u, _r, ctx) => {
  const id = await tid(ctx);
  const files = await prisma.file.findMany({ where: { taskId: id }, select: { storageKey: true } });
  await prisma.task.delete({ where: { id } });
  await Promise.all(files.map((f) => f.storageKey && removeUpload(f.storageKey)));
  return json({ ok: true });
}, { manager: true });
