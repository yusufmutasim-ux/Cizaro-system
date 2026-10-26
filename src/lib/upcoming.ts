import { prisma } from "./db";
import type { SessionUser } from "./auth";
import type { Prisma } from "@prisma/client";
import { str } from "./api";

export const upcomingSelect = { id: true, title: true, note: true, date: true, brandId: true, branchId: true, createdById: true, createdAt: true } as const;

/** Same rule as tasks: people with a branch only see items for every branch or for theirs. */
export function upcomingScope(user: SessionUser): Prisma.UpcomingWhereInput {
  if (user.role === "MANAGER" || !user.branchId) return {};
  return { OR: [{ branchId: null }, { branchId: user.branchId }] };
}

type Fields = { title?: string; note?: string; date?: string | null; brandId?: string | null; branchId?: string | null };

/** Validates a create/update body. Returns the fields to write, or an error key. */
export async function readFields(b: Record<string, unknown>, partial: boolean): Promise<Fields | { error: "err.needUpcoming" | "err.noBrand" }> {
  const out: Fields = {};
  if (!partial || "title" in b) {
    const title = str(b.title, 200)?.trim();
    if (!title) return { error: "err.needUpcoming" };
    out.title = title;
  }
  if ("note" in b) out.note = str(b.note, 2000)?.trim() ?? "";
  if ("date" in b) out.date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if ("brandId" in b || "branchId" in b) {
    const brandId = typeof b.brandId === "string" && b.brandId ? b.brandId : null;
    let branchId: string | null = null;
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { branches: { select: { id: true } } } });
      if (!brand) return { error: "err.noBrand" };
      if (typeof b.branchId === "string" && brand.branches.some((x) => x.id === b.branchId)) branchId = b.branchId;
    }
    out.brandId = brandId; out.branchId = branchId;
  }
  return out;
}

/** Everyone who can see an item with this branch. */
export async function audience(branchId: string | null) {
  const users = await prisma.user.findMany({
    where: { active: true, ...(branchId ? { OR: [{ role: "MANAGER" }, { branchId: null }, { branchId }] } : {}) },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
