import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { cookieLocale } from "@/lib/locale";
import { fail, json } from "@/lib/api";
import { t } from "@/lib/i18n";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail(t(await cookieLocale(), "err.badLogin"), 401);
  }
  await setSessionCookie(user.id);
  return json({ ok: true, locale: user.locale });
}
