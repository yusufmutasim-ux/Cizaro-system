import { prisma } from "./db";
import type { SessionUser } from "./auth";

/** Everyone below `id` in the reporting tree (reports, their reports, …). */
export async function subordinates(id: string): Promise<Set<string>> {
  const all = await prisma.user.findMany({ select: { id: true, leadId: true } });
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next = all.filter((u) => u.leadId && frontier.includes(u.leadId) && !out.has(u.id)).map((u) => u.id);
    next.forEach((x) => out.add(x));
    frontier = next;
  }
  return out;
}

/**
 * Who may set a task's assignee:
 * - managers: anyone, including clearing it;
 * - everyone else: on a new task, or one assigned to them or to someone below them (so a lead can pull work back
 *   or move it within their team), and only to themselves or someone below them.
 */
export async function canAssign(user: SessionUser, task: { assigneeId: string | null } | null, to: string | null) {
  if (user.role === "MANAGER") return true;
  const team = await subordinates(user.id);
  const mine = (id: string | null) => id === user.id || (id !== null && team.has(id));
  if (task && !mine(task.assigneeId)) return false;
  if (to === null) return !task; // a new task may start unassigned; only managers unassign an existing one
  return mine(to);
}
