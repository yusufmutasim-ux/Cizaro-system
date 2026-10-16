import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { route, json, fail } from "@/lib/api";

const pub = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export const GET = route(async () => json(await prisma.user.findMany({ select: pub, orderBy: { createdAt: "asc" } })));

export const POST = route(async (_u, req) => {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = b.role === "MANAGER" ? "MANAGER" : "DESIGNER";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return fail("اكتب اسم وإيميل صحيح");
  if (password.length < 8) return fail("الباسورد لازم يكون 8 حروف على الأقل");
  if (await prisma.user.findUnique({ where: { email } })) return fail("الإيميل ده متسجّل قبل كده");
  const user = await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) }, select: pub });
  return json(user, 201);
}, { manager: true });
