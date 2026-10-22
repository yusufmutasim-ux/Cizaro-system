import { prisma } from "@/lib/db";
import { route, json, type Params } from "@/lib/api";

export const GET = route<Params>(async (_r, { params }) => {
  const chats = await prisma.chat.findMany({ where: { brandId: (await params).id }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, updatedAt: true } });
  return json(chats.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })));
});

export const POST = route<Params>(async (_r, { params }) => {
  const chat = await prisma.chat.create({ data: { brandId: (await params).id } });
  return json({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt.toISOString() }, 201);
});
