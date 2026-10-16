import { prisma } from "@/lib/db";
import { route, json, fail, str } from "@/lib/api";
import { taskSelect, addActivity } from "@/lib/tasks";
import { PRIORITY, TYPES } from "@/lib/vocab";

export const GET = route(async () => {
  const tasks = await prisma.task.findMany({ select: taskSelect, orderBy: { createdAt: "desc" }, take: 2000 });
  return json(tasks);
});

export const POST = route(async (user, req) => {
  const b = await req.json().catch(() => ({}));
  const title = str(b.title, 200)?.trim();
  if (!title) return fail("اكتب اسم للتاسك");
  const due = typeof b.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due) ? b.due : null;
  const assigneeId = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
  const task = await prisma.task.create({
    data: {
      title,
      brief: str(b.brief) ?? "",
      type: TYPES.includes(b.type) ? b.type : TYPES[0],
      size: str(b.size, 40)?.trim() ?? "",
      due,
      priority: b.priority in PRIORITY ? b.priority : "normal",
      assigneeId,
      createdById: user.id,
    },
    select: taskSelect,
  });
  await addActivity(task.id, user.id, "created");
  return json(task, 201);
});
