import { prisma } from "@/lib/db";
import { route, json, fail, type Params } from "@/lib/api";
import { designDTO } from "@/lib/dto";

type Block = { type: string; text?: string; name?: string; fileId?: string; content?: unknown; tool_use_id?: string };
export type ChatView = { role: "user" | "assistant"; text: string; images: string[]; tools: string[]; designIds: string[] };

/** Turns the stored API transcript into chat bubbles: consecutive assistant steps merge into one reply. */
export const GET = route<Params>(async (_r, { params }) => {
  const chat = await prisma.chat.findUnique({ where: { id: (await params).id } });
  if (!chat) return fail("Chat not found", 404);
  const rows = await prisma.chatMessage.findMany({ where: { chatId: chat.id }, orderBy: { seq: "asc" } });
  const view: ChatView[] = [];
  const last = () => view[view.length - 1];
  const assistant = () => {
    if (last()?.role !== "assistant") view.push({ role: "assistant", text: "", images: [], tools: [], designIds: [] });
    return last();
  };
  for (const r of rows) {
    const blocks: Block[] = JSON.parse(r.content);
    if (r.role === "user") {
      const results = blocks.filter((b) => b.type === "tool_result");
      for (const t of results) {
        const first = Array.isArray(t.content) ? (t.content as Block[]).find((c) => c.type === "text")?.text : typeof t.content === "string" ? t.content : "";
        const m = first?.match(/^design_ids: (.*)$/m);
        if (m) assistant().designIds.push(...m[1].split(",").filter(Boolean));
      }
      if (results.length === blocks.length) continue;
      view.push({
        role: "user",
        text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        images: blocks.filter((b) => b.type === "image" && b.fileId).map((b) => `/api/files/${b.fileId}`),
        tools: [], designIds: [],
      });
    } else {
      const a = assistant();
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      if (text) a.text += (a.text ? "\n\n" : "") + text;
      for (const b of blocks) if (b.type === "mcp_tool_use" && b.name) a.tools.push(b.name);
    }
  }
  const ids = view.flatMap((v) => v.designIds);
  const designs = await prisma.design.findMany({ where: { id: { in: ids }, archived: false } });
  return json({ id: chat.id, title: chat.title, brandId: chat.brandId, messages: view, designs: designs.map(designDTO) });
});

export const PATCH = route<Params>(async (req, { params }) => {
  const { title } = await req.json().catch(() => ({}));
  const chat = await prisma.chat.update({ where: { id: (await params).id }, data: { title: String(title ?? "").slice(0, 80) } });
  return json({ id: chat.id, title: chat.title });
});

export const DELETE = route<Params>(async (_r, { params }) => {
  await prisma.chat.delete({ where: { id: (await params).id } }).catch(() => null);
  return json({ ok: true });
});
