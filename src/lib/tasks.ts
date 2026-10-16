import { prisma } from "./db";

export const taskSelect = {
  id: true, title: true, brief: true, type: true, size: true, due: true, priority: true, status: true,
  revisions: true, coverFileId: true, assigneeId: true, createdById: true, createdAt: true, updatedAt: true, doneAt: true,
  _count: { select: { files: true, activity: { where: { kind: "comment" } } } },
} as const;

export async function addActivity(taskId: number, userId: string, kind: string, extra: { text?: string; toStatus?: string; round?: number } = {}) {
  await prisma.activity.create({ data: { taskId, userId, kind, ...extra } });
}
