import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Sends signed-out visitors to the login, and signed-in ones past it.
 *
 * Next 16 renamed `middleware` to `proxy`. This is an optimistic check — it reads
 * the cookie and nothing else, so a request that gets past it still has to satisfy
 * the real checks in the page and in every route handler. It exists so a stale
 * tab lands on the login form instead of a blank page.
 *
 * The matcher also skips /r/, the customers' own receipts, which are protected
 * by a signed link instead of a login.
 *
 * The matcher skips /api (handlers answer 401 themselves, which a fetch can act
 * on, where a redirect to an HTML page would just confuse it) and static files.
 */
export function proxy(request: NextRequest) {
  const signedIn = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const onLogin = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|r/|_next/static|_next/image|favicon.ico|robots.txt|images|fonts).*)",
  ],
};
