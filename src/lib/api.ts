import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

type Handler<C> = (user: SessionUser, req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: requires a signed-in user, optionally a manager. */
export function route<C>(fn: Handler<C>, opts: { manager?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    const user = await currentUser();
    if (!user) return fail("سجّل دخول الأول", 401);
    if (opts.manager && user.role !== "MANAGER") return fail("الصلاحية دي للمدير بس", 403);
    try {
      return await fn(user, req, ctx);
    } catch (e) {
      console.error(e);
      return fail("حصلت مشكلة في السيرفر", 500);
    }
  };
}

export const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : undefined);
