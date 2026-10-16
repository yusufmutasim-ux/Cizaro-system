import { prisma } from "@/lib/db";
import { route, json, fail, str } from "@/lib/api";
import { taskSelect, addActivity } from "@/lib/tasks";
import { STATUS_KEYS, type Status } from "@/lib/vocab";

type Ctx = { params: Promise<{ id: string }> };

// Approving (→ done) and requesting changes are review decisions: managers only.
export const POST = route<Ctx>(async (user, req, { params }) => {
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const to = b.status as Status;
  const note = str(b.note)?.trim() || undefined;
  if (!STATUS_KEYS.includes(to)) return fail("حالة غير معروفة");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return fail("التاسك مش موجود", 404);
  if (task.status === to) return json(await prisma.task.findUnique({ where: { id }, select: taskSelect }));
  if ((to === "done" || to === "changes") && user.role !== "MANAGER") return fail("الاعتماد وطلب التعديلات للمدير بس", 403);
  if (to === "changes" && !note) return fail("اكتب التعديلات المطلوبة");

  const data: Record<string, unknown> = { status: to };
  if (to === "changes") data.revisions = task.revisions + 1;
  data.doneAt = to === "done" ? new Date() : null;
  const updated = await prisma.task.update({ where: { id }, data, select: taskSelect });

  if (to === "changes") await addActivity(id, user.id, "changes", { text: note, round: task.revisions + 1, toStatus: to });
  else if (to === "done" && task.status === "review") await addActivity(id, user.id, "approved", { text: note, toStatus: to });
  else if (to === "review") await addActivity(id, user.id, "submitted", { text: note, toStatus: to });
  else await addActivity(id, user.id, "status", { toStatus: to });
  return json(updated);
});
