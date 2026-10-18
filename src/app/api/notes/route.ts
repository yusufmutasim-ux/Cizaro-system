import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { notify, managerIds } from "@/lib/push";

// Managers see every note; everyone else sees the notes they sent.
export const GET = route(async (user) => {
  const where = user.role === "MANAGER" ? {} : { fromId: user.id };
  return json(await prisma.note.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }));
});

export const POST = route(async (user, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const text = str(b.text, 2000)?.trim();
  if (!text) return e("err.emptyNote");
  const note = await prisma.note.create({ data: { fromId: user.id, text } });
  await notify(await managerIds(), { kind: "note", title: "push.note.title", vars: { who: user.name }, text: text.slice(0, 160), url: "/settings#notes", tag: `note-${note.id}` }, user.id);
  return json(note, 201);
});
