import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { route, json, fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (me, req, { params }) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; role?: string; active?: boolean; passwordHash?: string } = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.role === "MANAGER" || b.role === "DESIGNER") data.role = b.role;
  if (typeof b.active === "boolean") data.active = b.active;
  if (typeof b.password === "string") {
    if (b.password.length < 8) return fail("الباسورد لازم يكون 8 حروف على الأقل");
    data.passwordHash = await bcrypt.hash(b.password, 10);
  }
  if (id === me.id && (data.active === false || data.role === "DESIGNER")) return fail("مينفعش تشيل صلاحية المدير من نفسك");
  const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true } });
  return json(user);
}, { manager: true });
