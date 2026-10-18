import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";

const pub = { id: true, name: true, email: true, role: true, active: true, createdAt: true, avatarAt: true, leadId: true } as const;

export const GET = route(async () => json(await prisma.user.findMany({ select: pub, orderBy: { createdAt: "asc" } })));

export const POST = route(async (_u, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  const role = b.role === "MANAGER" ? "MANAGER" : "DESIGNER";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return e("err.nameEmail");
  if (password.length < 8) return e("err.passLen");
  if (await prisma.user.findUnique({ where: { email } })) return e("err.emailTaken");
  const user = await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) }, select: pub });
  return json(user, 201);
}, { manager: true });
