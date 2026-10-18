import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { route, json, str } from "@/lib/api";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { NOTIFY_KINDS } from "@/lib/push";

const out = async (id: string) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, email: true, role: true, locale: true, avatarAt: true, notifyPrefs: true } });
  let prefs: Record<string, boolean> = {};
  try { prefs = JSON.parse(u.notifyPrefs); } catch {}
  return { ...u, notifyPrefs: Object.fromEntries(NOTIFY_KINDS.map((k) => [k, prefs[k] !== false])) };
};

export const GET = route(async (user) => json(await out(user.id)));

// { name?, locale?, notifyPrefs?: {kind: bool}, currentPassword?, newPassword? }
export const PATCH = route(async (user, req, _c, e) => {
  const b = await req.json().catch(() => ({}));
  const data: { name?: string; locale?: string; notifyPrefs?: string; passwordHash?: string } = {};
  if ("name" in b) { const n = str(b.name, 60)?.trim(); if (!n) return e("err.nameEmpty"); data.name = n; }
  if (isLocale(b.locale)) {
    data.locale = b.locale;
    (await cookies()).set(LOCALE_COOKIE, b.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  if (b.notifyPrefs && typeof b.notifyPrefs === "object") {
    data.notifyPrefs = JSON.stringify(Object.fromEntries(NOTIFY_KINDS.filter((k) => b.notifyPrefs[k] === false).map((k) => [k, false])));
  }
  if ("newPassword" in b) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(String(b.currentPassword ?? ""), u.passwordHash))) return e("err.wrongPassword");
    if (String(b.newPassword).length < 8) return e("err.passLen");
    data.passwordHash = await bcrypt.hash(String(b.newPassword), 10);
  }
  await prisma.user.update({ where: { id: user.id }, data });
  return json(await out(user.id));
});
