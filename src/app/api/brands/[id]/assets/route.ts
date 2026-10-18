import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { saveUpload, MAX_UPLOAD } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };
const CATEGORIES = ["logo", "font", "color", "guideline", "template", "other"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const pub = ({ storageKey, ...a }: { storageKey: string | null } & Record<string, unknown>) => ({ ...a, hasFile: !!storageKey });

export const GET = route<Ctx>(async (_u, _r, { params }, e) => {
  const { id } = await params;
  if (!(await prisma.brand.findUnique({ where: { id }, select: { id: true } }))) return e("err.noBrand", 404);
  const assets = await prisma.brandAsset.findMany({ where: { brandId: id }, orderBy: { createdAt: "asc" } });
  return json(assets.map(pub));
});

// multipart: category, file (repeatable) — or JSON { category: "color", name, value: "#RRGGBB" }
export const POST = route<Ctx>(async (user, req, { params }, e) => {
  const { id: brandId } = await params;
  if (!(await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }))) return e("err.noBrand", 404);

  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    const value = typeof b.value === "string" ? b.value.trim() : "";
    if (!HEX.test(value)) return e("err.badHex");
    const a = await prisma.brandAsset.create({ data: { brandId, category: "color", name: str(b.name, 60)?.trim() || value.toUpperCase(), value: value.toUpperCase(), uploadedById: user.id } });
    return json(pub(a), 201);
  }

  const form = await req.formData();
  const category = String(form.get("category"));
  if (!CATEGORIES.includes(category) || category === "color") return e("err.badCategory");
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return e("err.noFiles");
  const tooBig = files.find((f) => f.size > MAX_UPLOAD);
  if (tooBig) return e("err.tooBig", 400, { name: tooBig.name });
  const out = [];
  for (const file of files) {
    const storageKey = await saveUpload(file);
    const a = await prisma.brandAsset.create({
      data: { brandId, category, name: file.name.slice(0, 200), storageKey, mime: file.type || mimeFromName(file.name), size: file.size, uploadedById: user.id },
    });
    out.push(pub(a));
  }
  return json(out, 201);
}, { manager: true });

function mimeFromName(n: string) {
  const ext = n.split(".").pop()?.toLowerCase() ?? "";
  return ({ ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" } as Record<string, string>)[ext] ?? "application/octet-stream";
}
