import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { subordinates } from "@/lib/team";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (me, req, { params }, e) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; role?: string; active?: boolean; passwordHash?: string; leadId?: string | null } = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.role === "MANAGER" || b.role === "DESIGNER") data.role = b.role;
  if (typeof b.active === "boolean") data.active = b.active;
  if (typeof b.password === "string") {
    if (b.password.length < 8) return e("err.passLen");
    data.passwordHash = await bcrypt.hash(b.password, 10);
  }
  if (id === me.id && (data.active === false || data.role === "DESIGNER")) return e("err.selfDemote");
  if ("leadId" in b) {
    const lead = typeof b.leadId === "string" && b.leadId ? b.leadId : null;
    if (lead && (lead === id || (await subordinates(id)).has(lead))) return e("err.leadCycle");
    if (lead && !(await prisma.user.findUnique({ where: { id: lead }, select: { id: true } }))) return e("err.noDesigner");
    data.leadId = lead;
  }
  const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true, leadId: true } });
  return json(user);
}, { manager: true });
