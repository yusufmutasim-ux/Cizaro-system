import { prisma } from "@/lib/db";
import { route, json, fail } from "@/lib/api";
import { publicKey, notify } from "@/lib/push";

export const GET = route(async () => json({ key: await publicKey() }));

// Save this device's subscription: { endpoint, keys: { p256dh, auth } }
export const POST = route(async (user, req) => {
  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b.endpoint === "string" && b.endpoint.startsWith("https://") ? b.endpoint : null;
  const p256dh = b.keys?.p256dh, auth = b.keys?.auth;
  if (!endpoint || typeof p256dh !== "string" || typeof auth !== "string") return fail("bad subscription");
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  });
  if (b.test) await notify([user.id], { title: "push.test.title", body: "push.test.body", tag: "test" });
  return json({ ok: true }, 201);
});

export const DELETE = route(async (user, req) => {
  const b = await req.json().catch(() => ({}));
  if (typeof b.endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId: user.id } });
  return json({ ok: true });
});
