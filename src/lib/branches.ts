import { prisma } from "./db";
import type { SessionUser } from "./auth";
import type { Prisma } from "@prisma/client";

/** Tasks a person may see: managers see every branch; others only their own branch (plus brands without branches). */
export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  if (user.role === "MANAGER" || !user.branchId) return {};
  return { OR: [{ branchId: null }, { branchId: user.branchId }] };
}

export const canSee = (user: SessionUser, task: { branchId: string | null }) =>
  user.role === "MANAGER" || !user.branchId || !task.branchId || task.branchId === user.branchId;

/**
 * The branch a task should sit in for this brand. Brands without branches get null.
 * Non-managers with a branch always file into their own branch.
 */
export async function resolveBranch(brandId: string | null, wanted: unknown, user: SessionUser) {
  if (!brandId) return null;
  const branches = await prisma.branch.findMany({ where: { brandId }, orderBy: { sort: "asc" }, select: { id: true } });
  if (!branches.length) return null;
  const ids = branches.map((b) => b.id);
  if (user.role !== "MANAGER" && user.branchId && ids.includes(user.branchId)) return user.branchId;
  if (typeof wanted === "string" && ids.includes(wanted)) return wanted;
  if (user.branchId && ids.includes(user.branchId)) return user.branchId;
  return ids[0];
}

/** Someone from another branch can't take the task: they wouldn't be able to see it. */
export async function sameBranch(taskBranchId: string | null, assigneeId: string | null) {
  if (!taskBranchId || !assigneeId) return true;
  const u = await prisma.user.findUnique({ where: { id: assigneeId }, select: { branchId: true, role: true } });
  return !u?.branchId || u.role === "MANAGER" || u.branchId === taskBranchId;
}
