import { NextResponse, type NextRequest } from "next/server";

// Fast redirect for visitors with no session cookie. The pages and API routes
// verify the session themselves, so a forged cookie gets no further than this.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("cz_session")?.value) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/team", "/brands", "/settings"] };
