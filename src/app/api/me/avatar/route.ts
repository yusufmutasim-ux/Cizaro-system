import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { saveUpload, removeUpload } from "@/lib/storage";

// multipart: file=<image>. The app resizes photos to a small square before sending.
export const POST = route(async (user, req, _c, e) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !/^image\/(png|jpeg|webp)$/.test(file.type)) return e("err.badImage");
  if (file.size > 3 * 1024 * 1024) return e("err.imageTooBig");
  const old = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  const key = await saveUpload(file);
  const u = await prisma.user.update({ where: { id: user.id }, data: { avatarKey: key, avatarAt: new Date() }, select: { avatarAt: true } });
  if (old?.avatarKey) await removeUpload(old.avatarKey);
  return json({ avatarAt: u.avatarAt });
});

export const DELETE = route(async (user) => {
  const old = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  await prisma.user.update({ where: { id: user.id }, data: { avatarKey: null, avatarAt: null } });
  if (old?.avatarKey) await removeUpload(old.avatarKey);
  return json({ avatarAt: null });
});
