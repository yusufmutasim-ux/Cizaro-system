import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { taskSelect, addActivity } from "@/lib/tasks";
import { notify, managerIds } from "@/lib/push";
import { STATUS_KEYS, type Status } from "@/lib/vocab";
import { normalizeType } from "@/lib/i18n";

type Ctx = { params: Promise<{ id: string }> };

// Approving (→ done) and requesting changes are review decisions: managers only.
export const POST = route<Ctx>(async (user, req, { params }, e) => {
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const to = b.status as Status;
  const note = str(b.note)?.trim() || undefined;
  if (!STATUS_KEYS.includes(to)) return e("err.badStatus");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return e("err.noTask", 404);
  const out = (t: { type: string }) => json({ ...t, type: normalizeType(t.type) });
  if (task.status === to) return out((await prisma.task.findUnique({ where: { id }, select: taskSelect }))!);
  if ((to === "done" || to === "changes") && user.role !== "MANAGER") return e("err.reviewManager", 403);
  if (to === "changes" && !note) return e("err.needNote");

  const data: Record<string, unknown> = { status: to };
  if (to === "changes") data.revisions = task.revisions + 1;
  data.doneAt = to === "done" ? new Date() : null;
  const updated = await prisma.task.update({ where: { id }, data, select: taskSelect });

  const url = `/?task=${id}`, tag = `task-${id}`;
  if (to === "changes") {
    await addActivity(id, user.id, "changes", { text: note, round: task.revisions + 1, toStatus: to });
    await notify([task.assigneeId], { title: "push.changes.title", text: `${task.title}: ${note}`, url, tag }, user.id);
  } else if (to === "done" && task.status === "review") {
    await addActivity(id, user.id, "approved", { text: note, toStatus: to });
    await notify([task.assigneeId], { title: "push.approved.title", body: "push.approved.body", vars: { task: task.title }, url, tag }, user.id);
  } else if (to === "review") {
    await addActivity(id, user.id, "submitted", { text: note, toStatus: to });
    await notify(await managerIds(), { title: "push.review.title", body: "push.review.body", vars: { who: user.name, task: task.title }, url, tag }, user.id);
  } else await addActivity(id, user.id, "status", { toStatus: to });
  return out(updated);
});
