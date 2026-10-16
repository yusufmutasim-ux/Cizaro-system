import { prisma } from "@/lib/db";
import { route, json, fail } from "@/lib/api";
import { addActivity } from "@/lib/tasks";
import { saveUpload, MAX_UPLOAD } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// multipart/form-data: slot=ref|delivery, file=<File> (repeatable)
// application/json: { slot, url } to attach a Drive / WeTransfer link
export const POST = route<Ctx>(async (user, req, { params }) => {
  const taskId = Number((await params).id);
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) return fail("التاسك مش موجود", 404);

  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    const slot = b.slot === "delivery" ? "delivery" : "ref";
    let u: URL;
    try { u = new URL(String(b.url)); } catch { return fail("حط لينك كامل يبدأ بـ https://"); }
    if (!/^https?:$/.test(u.protocol)) return fail("حط لينك كامل يبدأ بـ https://");
    const name = u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.slice(0, 24) : "");
    const f = await prisma.file.create({ data: { taskId, slot, kind: "link", name, url: u.href, uploadedById: user.id } });
    await addActivity(taskId, user.id, "file", { text: `ضاف لينك ${slot === "delivery" ? "تسليم" : "مرجع"}: ${name}` });
    return json(f, 201);
  }

  const form = await req.formData();
  const slot = form.get("slot") === "delivery" ? "delivery" : "ref";
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("مفيش ملفات");
  const created = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD) return fail(`«${file.name}» أكبر من 50MB. حط لينك Drive بداله.`);
    const storageKey = await saveUpload(file);
    const f = await prisma.file.create({
      data: { taskId, slot, kind: "upload", name: file.name.slice(0, 200), storageKey, mime: file.type || "application/octet-stream", size: file.size, uploadedById: user.id },
    });
    created.push(f);
    if (slot === "delivery" && f.mime?.startsWith("image/")) await prisma.task.update({ where: { id: taskId }, data: { coverFileId: f.id } });
    await addActivity(taskId, user.id, "file", { text: `رفع ${slot === "delivery" ? "تسليم" : "مرجع"}: ${file.name}` });
  }
  return json(created.map(({ storageKey, ...f }) => f), 201);
});
