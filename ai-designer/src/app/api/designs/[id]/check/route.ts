import { prisma } from "@/lib/db";
import { route, json, fail, type Params } from "@/lib/api";
import { checkDesign } from "@/lib/review";

export const maxDuration = 300;

// multipart: file = the composed ad as PNG/JPEG from the editor
export const POST = route<Params>(async (req, { params }) => {
  const { id } = await params;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return fail("مفيش صورة للمراجعة");
  const check = await checkDesign(id, Buffer.from(await file.arrayBuffer()));
  await prisma.design.update({ where: { id }, data: { check: JSON.stringify({ ...check, at: new Date().toISOString() }) } });
  return json(check);
});
