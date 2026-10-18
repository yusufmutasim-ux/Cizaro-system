import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { taskSelect, brandIdOr, brandName } from "@/lib/tasks";
import { removeUpload } from "@/lib/storage";
import { notify } from "@/lib/push";
import { PRIORITY_LABELS, normalizeType } from "@/lib/i18n";

type Ctx = { params: Promise<{ id: string }> };
const tid = async (ctx: Ctx) => Number((await ctx.params).id);

export const GET = route<Ctx>(async (_u, _r, ctx, e) => {
  const id = await tid(ctx);
  const task = await prisma.task.findUnique({ where: { id }, select: taskSelect });
  if (!task) return e("err.noTask", 404);
  const [activity, files] = await Promise.all([
    prisma.activity.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.file.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  return json({
    task: { ...task, type: normalizeType(task.type) },
    activity,
    files: files.map(({ storageKey, ...f }) => ({ ...f, href: f.kind === "link" ? f.url : `/api/files/${f.id}` })),
  });
});

export const PATCH = route<Ctx>(async (user, req, ctx, e) => {
  const id = await tid(ctx);
  const b = await req.json().catch(() => ({}));
  const before = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true } });
  if (!before) return e("err.noTask", 404);
  const data: Record<string, unknown> = {};
  if ("title" in b) { const t = str(b.title, 200)?.trim(); if (!t) return e("err.emptyTitle"); data.title = t; }
  if ("brief" in b) data.brief = str(b.brief) ?? "";
  if ("type" in b) data.type = normalizeType(String(b.type));
  if ("size" in b) data.size = str(b.size, 40)?.trim() ?? "";
  if ("due" in b) data.due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  if ("priority" in b && b.priority in PRIORITY_LABELS) data.priority = b.priority;
  if ("brandId" in b) data.brandId = await brandIdOr(b.brandId);
  if ("assigneeId" in b) {
    const a = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
    if (a && !(await prisma.user.findUnique({ where: { id: a } }))) return e("err.noDesigner");
    data.assigneeId = a;
  }
  const task = await prisma.task.update({ where: { id }, data, select: taskSelect });
  if ("assigneeId" in data && data.assigneeId && data.assigneeId !== before.assigneeId) {
    const bn = await brandName(task.brandId);
    await notify([task.assigneeId], { title: "push.assigned.title", text: bn ? `${bn} · ${task.title}` : task.title, url: `/?task=${id}`, tag: `task-${id}` }, user.id);
  }
  return json({ ...task, type: normalizeType(task.type) });
});

export const DELETE = route<Ctx>(async (_u, _r, ctx) => {
  const id = await tid(ctx);
  const files = await prisma.file.findMany({ where: { taskId: id }, select: { storageKey: true } });
  await prisma.task.delete({ where: { id } });
  await Promise.all(files.map((f) => f.storageKey && removeUpload(f.storageKey)));
  return json({ ok: true });
}, { manager: true });
