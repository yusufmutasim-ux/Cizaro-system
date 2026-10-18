import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { taskSelect, addActivity, brandIdOr } from "@/lib/tasks";
import { notify } from "@/lib/push";
import { PRIORITY_LABELS, normalizeType } from "@/lib/i18n";

export const GET = route(async () => {
  const tasks = await prisma.task.findMany({ select: taskSelect, orderBy: { createdAt: "desc" }, take: 2000 });
  return json(tasks.map((t) => ({ ...t, type: normalizeType(t.type) })));
});

export const POST = route(async (user, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const title = str(b.title, 200)?.trim();
  if (!title) return e("err.needTitle");
  const due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  const assigneeId = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
  if (assigneeId && !(await prisma.user.findUnique({ where: { id: assigneeId } }))) return e("err.noDesigner");
  const task = await prisma.task.create({
    data: {
      title,
      brief: str(b.brief) ?? "",
      type: normalizeType(String(b.type ?? "social")),
      size: str(b.size, 40)?.trim() ?? "",
      due,
      priority: b.priority in PRIORITY_LABELS ? b.priority : "normal",
      assigneeId,
      brandId: await brandIdOr(b.brandId),
      createdById: user.id,
    },
    select: taskSelect,
  });
  await addActivity(task.id, user.id, "created");
  const brand = await prisma.brand.findUnique({ where: { id: task.brandId ?? "" }, select: { name: true } });
  await notify([assigneeId], { kind: "assigned", title: "push.assigned.title", text: brand ? `${brand.name} · ${title}` : title, url: `/?task=${task.id}`, tag: `task-${task.id}` }, user.id);
  return json(task, 201);
});
