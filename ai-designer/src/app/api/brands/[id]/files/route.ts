import { prisma } from "@/lib/db";
import { route, json, fail, type Params } from "@/lib/api";
import { fileDTO } from "@/lib/brands";
import { saveUpload, MAX_UPLOAD, mimeFromName } from "@/lib/storage";

const KINDS = ["logo", "font", "reference", "product", "guideline", "attachment"];

export const GET = route<Params>(async (_r, { params }) => {
  const files = await prisma.brandFile.findMany({ where: { brandId: (await params).id, kind: { not: "attachment" } }, orderBy: { createdAt: "asc" } });
  return json(files.map(fileDTO));
});

// multipart: kind, file (repeatable)
export const POST = route<Params>(async (req, { params }) => {
  const { id: brandId } = await params;
  if (!(await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }))) return fail("البراند مش موجود", 404);
  const form = await req.formData();
  const kind = String(form.get("kind"));
  if (!KINDS.includes(kind)) return fail("نوع الملف مش معروف");
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("اختار ملف");
  const big = files.find((f) => f.size > MAX_UPLOAD);
  if (big) return fail(`${big.name} أكبر من 40MB`);
  const out = [];
  for (const file of files) {
    const mime = file.type || mimeFromName(file.name);
    if ((kind === "attachment" || kind === "reference" || kind === "product") && !mime.startsWith("image/")) return fail(`${file.name}: لازم يكون صورة`);
    const storageKey = await saveUpload(file);
    out.push(fileDTO(await prisma.brandFile.create({ data: { brandId, kind, name: file.name.slice(0, 200), storageKey, mime, size: file.size } })));
  }
  return json(out, 201);
});
