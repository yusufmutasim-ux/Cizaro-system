import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// { read: boolean }
export const PATCH = route<Ctx>(async (_u, req, { params }) => {
  const b = await req.json().catch(() => ({}));
  const note = await prisma.note.update({ where: { id: (await params).id }, data: { readAt: b.read ? new Date() : null } });
  return json(note);
}, { manager: true });

export const DELETE = route<Ctx>(async (_u, _r, { params }) => {
  await prisma.note.deleteMany({ where: { id: (await params).id } });
  return json({ ok: true });
}, { manager: true });
