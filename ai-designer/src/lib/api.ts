import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, validSession } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Wraps a route handler: requires the session cookie when a password is set, and turns errors into JSON. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    if (!(await validSession((await cookies()).get(COOKIE)?.value))) return fail("Please sign in", 401);
    try {
      return await fn(req, ctx);
    } catch (err) {
      console.error(err);
      return fail(err instanceof Error ? err.message : "Server error", 500);
    }
  };
}

export type Params<K extends string = "id"> = { params: Promise<Record<K, string>> };
