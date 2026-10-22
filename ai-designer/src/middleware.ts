import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, validSession } from "@/lib/auth";

// Pages need the session cookie when APP_PASSWORD is set. API routes check it themselves.
export async function middleware(req: NextRequest) {
  if (await validSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/", "/brands/:path*", "/settings"] };
