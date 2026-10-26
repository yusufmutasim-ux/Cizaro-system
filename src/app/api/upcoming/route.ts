import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { notify } from "@/lib/push";
import { upcomingSelect, upcomingScope, readFields, audience } from "@/lib/upcoming";

export const GET = route(async (user) => {
  const rows = await prisma.upcoming.findMany({ where: upcomingScope(user), select: upcomingSelect, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 500 });
  return json(rows);
});

export const POST = route(async (user, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const f = await readFields(b, false);
  if ("error" in f) return e(f.error, f.error === "err.noBrand" ? 404 : 400);
  const row = await prisma.upcoming.create({ data: { title: f.title!, note: f.note ?? "", date: f.date ?? null, brandId: f.brandId ?? null, branchId: f.branchId ?? null, createdById: user.id }, select: upcomingSelect });
  if (b.notify !== false) {
    const brand = row.brandId ? await prisma.brand.findUnique({ where: { id: row.brandId }, select: { name: true } }) : null;
    await notify(await audience(row.branchId), {
      kind: "upcoming", title: "push.upcoming.title", vars: { title: row.title },
      text: [brand?.name, row.date, row.note].filter(Boolean).join(" · ").slice(0, 160) || undefined,
      body: "push.upcoming.body", url: "/?upcoming=1", tag: `upcoming-${row.id}`,
    }, user.id);
  }
  return json(row, 201);
}, { manager: true });
