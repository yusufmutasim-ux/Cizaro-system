import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { route, json } from "@/lib/api";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const GET = route(async (user) => json(user));

// { locale: "ar" | "en" } — saved on the account so notifications use it too
export const PATCH = route(async (user, req) => {
  const b = await req.json().catch(() => ({}));
  if (isLocale(b.locale)) {
    await prisma.user.update({ where: { id: user.id }, data: { locale: b.locale } });
    (await cookies()).set(LOCALE_COOKIE, b.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return json({ ok: true });
});
