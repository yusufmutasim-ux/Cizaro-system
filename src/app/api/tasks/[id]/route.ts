import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { taskSelect, brandIdOr, brandName, addActivity } from "@/lib/tasks";
import { canAssign } from "@/lib/team";
import { canSee, resolveBranch, sameBranch } from "@/lib/branches";
import { removeUpload } from "@/lib/storage";
import { notify } from "@/lib/push";
import { PRIORITY_LABELS, normalizeType } from "@/lib/i18n";

type Ctx = { params: Promise<{ id: string }> };
const tid = async (ctx: Ctx) => Number((await ctx.params).id);

export const GET = route<Ctx>(async (user, _r, ctx, e) => {
  const id = await tid(ctx);
  const task = await prisma.task.findUnique({ where: { id }, select: taskSelect });
  if (!task || !canSee(user, task)) return e("err.noTask", 404);
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
  const before = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true, brandId: true, branchId: true } });
  if (!before || !canSee(user, before)) return e("err.noTask", 404);
  const data: Record<string, unknown> = {};
  if ("title" in b) { const t = str(b.title, 200)?.trim(); if (!t) return e("err.emptyTitle"); data.title = t; }
  if ("brief" in b) data.brief = str(b.brief) ?? "";
  if ("type" in b) data.type = normalizeType(String(b.type));
  if ("size" in b) data.size = str(b.size, 40)?.trim() ?? "";
  if ("due" in b) data.due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  if ("priority" in b && b.priority in PRIORITY_LABELS) data.priority = b.priority;
  if ("brandId" in b) data.brandId = await brandIdOr(b.brandId);
  if ("brandId" in b || "branchId" in b) {
    data.branchId = await resolveBranch((data.brandId as string | null | undefined) ?? before.brandId, "branchId" in b ? b.branchId : before.branchId, user);
  }
  const branchAfter = "branchId" in data ? (data.branchId as string | null) : before.branchId;
  if ("assigneeId" in b) {
    const a = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
    if (a && !(await prisma.user.findUnique({ where: { id: a } }))) return e("err.noDesigner");
    if (a !== before.assigneeId && !(await canAssign(user, before, a))) return e("err.cantAssign", 403);
    if (!(await sameBranch(branchAfter, a))) return e("err.otherBranch");
    data.assigneeId = a;
  }
  if (!("assigneeId" in data) && "branchId" in data && !(await sameBranch(branchAfter, before.assigneeId))) data.assigneeId = null;
  const task = await prisma.task.update({ where: { id }, data, select: taskSelect });
  if ("assigneeId" in data && data.assigneeId !== before.assigneeId) {
    await addActivity(id, user.id, "assign", { text: (data.assigneeId as string | null) ?? "" });
  }
  if ("assigneeId" in data && data.assigneeId && data.assigneeId !== before.assigneeId && data.assigneeId !== user.id) {
    const bn = await brandName(task.brandId);
    await notify([task.assigneeId], { kind: "assigned", title: "push.assigned.title", vars: { who: user.name }, text: bn ? `${bn} · ${task.title}` : task.title, url: `/?task=${id}`, tag: `task-${id}` }, user.id);
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
