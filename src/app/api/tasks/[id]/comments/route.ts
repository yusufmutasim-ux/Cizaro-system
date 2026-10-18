import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { addActivity } from "@/lib/tasks";
import { notify, managerIds } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

// Notifies the designer and whoever created the task; designers' comments also reach managers.
export const POST = route<Ctx>(async (user, req, { params }, e) => {
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const text = str(b.text)?.trim();
  if (!text) return e("err.emptyComment");
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, assigneeId: true, createdById: true } });
  if (!task) return e("err.noTask", 404);
  await addActivity(id, user.id, "comment", { text });
  await prisma.task.update({ where: { id }, data: { updatedAt: new Date() } });
  const to = [task.assigneeId, task.createdById, ...(user.role === "DESIGNER" ? await managerIds() : [])];
  await notify(to, { kind: "comment", title: "push.comment.title", vars: { who: user.name }, text: `${task.title}: ${text.slice(0, 140)}`, url: `/?task=${id}`, tag: `task-${id}` }, user.id);
  return json({ ok: true }, 201);
});
