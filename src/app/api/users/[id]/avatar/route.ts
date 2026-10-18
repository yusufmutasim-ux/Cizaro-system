import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { readUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// The URL carries ?v=<avatarAt>, so a changed photo gets a new URL and old ones can cache forever.
export const GET = route<Ctx>(async (_u, _r, { params }, e) => {
  const u = await prisma.user.findUnique({ where: { id: (await params).id }, select: { avatarKey: true } });
  const buf = u?.avatarKey ? await readUpload(u.avatarKey).catch(() => null) : null;
  if (!buf) return e("err.noFile", 404);
  const ext = u!.avatarKey!.split(".").pop();
  const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
});
