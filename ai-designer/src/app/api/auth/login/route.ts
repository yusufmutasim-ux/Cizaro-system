import { cookies } from "next/headers";
import { COOKIE, sessionToken } from "@/lib/auth";
import { fail, json } from "@/lib/api";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) return fail("Wrong password", 401);
  (await cookies()).set(COOKIE, await sessionToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return json({ ok: true });
}
