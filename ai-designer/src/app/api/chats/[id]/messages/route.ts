import { prisma } from "@/lib/db";
import { route, fail, type Params } from "@/lib/api";
import { appendMessage, runTurn, type DesignerEvent } from "@/lib/designer";
import { getConfig } from "@/lib/settings";
import { fileToken } from "@/lib/auth";

export const maxDuration = 800;

const running = new Set<string>();

// { text, fileIds?: string[] } → NDJSON stream of DesignerEvent
export const POST = route<Params>(async (req, { params }) => {
  const { id } = await params;
  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) return fail("Chat not found", 404);
  if (running.has(id)) return fail("The designer is still working on the previous request", 409);
  const b = await req.json().catch(() => ({}));
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 20000) : "";
  const fileIds: string[] = Array.isArray(b.fileIds) ? b.fileIds.filter((x: unknown) => typeof x === "string").slice(0, 10) : [];
  const files = await prisma.brandFile.findMany({ where: { id: { in: fileIds }, brandId: chat.brandId, mime: { startsWith: "image/" } } });
  if (!text && !files.length) return fail("Write your request");

  // Images first, then text. Attachment URLs are listed so the designer can hand them to Higgsfield as references.
  const { appUrl } = await getConfig();
  const links = appUrl ? await Promise.all(files.map(async (f, i) => `Image ${i + 1} (${f.name}): ${appUrl}/api/public/${await fileToken(f.id)}`)) : [];
  const content = [
    ...files.map((f) => ({ type: "image" as const, fileId: f.id })),
    { type: "text" as const, text: (text || "(see attached images)") + (links.length ? `\n\n[Attached image URLs, usable as generation references]\n${links.join("\n")}` : "") },
  ];
  await appendMessage(id, "user", content as never);
  if (!chat.title) await prisma.chat.update({ where: { id }, data: { title: (text || "Attached images").replace(/\s+/g, " ").slice(0, 60) } });

  const enc = new TextEncoder();
  running.add(id);
  const stream = new ReadableStream({
    async start(ctrl) {
      let open = true;
      const emit = (e: DesignerEvent) => { if (!open) return; try { ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { open = false; } };
      try { await runTurn(id, emit); }
      catch (err) { console.error(err); emit({ t: "error", message: err instanceof Error ? err.message : "Something went wrong" }); emit({ t: "done" }); }
      finally { running.delete(id); if (open) try { ctrl.close(); } catch {} }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
});
