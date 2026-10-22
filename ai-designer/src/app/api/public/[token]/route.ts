import { prisma } from "@/lib/db";
import { verifyFileToken } from "@/lib/auth";
import { readStored } from "@/lib/storage";

// Signed, unguessable links to brand images, so Higgsfield can use logos, products and references when generating.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = await verifyFileToken((await params).token);
  const f = id && (await prisma.brandFile.findUnique({ where: { id } }));
  const buf = f && f.mime.startsWith("image/") && f.mime !== "image/svg+xml" ? await readStored(f.storageKey).catch(() => null) : null;
  if (!f || !buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
