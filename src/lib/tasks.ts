import { prisma } from "./db";

export const taskSelect = {
  id: true, title: true, brief: true, type: true, size: true, due: true, priority: true, status: true,
  revisions: true, coverFileId: true, brandId: true, assigneeId: true, createdById: true, createdAt: true, updatedAt: true, doneAt: true,
  _count: { select: { files: true, activity: { where: { kind: "comment" } } } },
} as const;

export async function addActivity(taskId: number, userId: string, kind: string, extra: { text?: string; toStatus?: string; round?: number } = {}) {
  await prisma.activity.create({ data: { taskId, userId, kind, ...extra } });
}

/** The brand a new task goes to when none (or an unknown one) is given. */
export async function brandIdOr(v: unknown) {
  if (typeof v === "string" && v && (await prisma.brand.findUnique({ where: { id: v }, select: { id: true } }))) return v;
  return (await prisma.brand.findFirst({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true } }))?.id ?? null;
}

export async function brandName(id: string | null) {
  return id ? (await prisma.brand.findUnique({ where: { id }, select: { name: true } }))?.name ?? "" : "";
}
