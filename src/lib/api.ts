import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./auth";
import { cookieLocale } from "./locale";
import { t, type Key } from "./i18n";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

type Ctx<C> = C;
type Handler<C> = (user: SessionUser, req: Request, ctx: Ctx<C>, e: (key: Key, status?: number, vars?: Record<string, string | number>) => Response) => Promise<Response>;

/** Wraps a route handler: requires a signed-in user (optionally a manager) and hands it a localized error helper. */
export function route<C>(fn: Handler<C>, opts: { manager?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    const user = await currentUser();
    if (!user) return fail(t(await cookieLocale(), "err.signIn"), 401);
    const e = (key: Key, status = 400, vars?: Record<string, string | number>) => fail(t(user.locale, key, vars), status);
    if (opts.manager && user.role !== "MANAGER") return e("err.managerOnly", 403);
    try {
      return await fn(user, req, ctx, e);
    } catch (err) {
      console.error(err);
      return e("err.server", 500);
    }
  };
}

export const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : undefined);
