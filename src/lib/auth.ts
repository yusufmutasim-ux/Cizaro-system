import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const COOKIE = "cz_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  (await cookies()).set(COOKIE, await signSession(userId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export type SessionUser = { id: string; name: string; email: string; role: "MANAGER" | "DESIGNER" };

export async function currentUser(): Promise<SessionUser | null> {
  const id = await verifySession((await cookies()).get(COOKIE)?.value);
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role === "MANAGER" ? "MANAGER" : "DESIGNER" };
}
