import { prisma } from "@/lib/db";
import { route, json, type Params } from "@/lib/api";
import { extractBrandBook } from "@/lib/review";

export const maxDuration = 300;

// { fileIds: string[], notes?: string } → filled brand book (not saved; the editor shows it for review first)
export const POST = route<Params>(async (req, { params }) => {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.fileIds) ? b.fileIds.filter((x: unknown) => typeof x === "string").slice(0, 10) : [];
  await prisma.brand.findUniqueOrThrow({ where: { id } });
  return json(await extractBrandBook(id, ids, typeof b.notes === "string" ? b.notes.slice(0, 8000) : ""));
});
