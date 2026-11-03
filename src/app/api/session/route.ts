import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { noStore, requestHasSession } from "@/lib/guard";
import {
  SESSION_COOKIE,
  issueSession,
  sessionCookieOptions,
} from "@/lib/session";

/**
 * Is the browser still signed in? The till asks this every so often and when it
 * comes back to the screen, so a session that ran out is noticed straight away
 * rather than on the next save.
 *
 * With `?active=1` the till is saying someone has been using it, so a session
 * that is still good is renewed for another full period. That makes the timeout
 * about sitting untouched, not about how long ago they signed in. An expired
 * session is never renewed: it answers 401 like any other.
 */
export async function GET(request: Request) {
  if (!requestHasSession(request))
    return NextResponse.json(
      { error: "Sign in again." },
      { status: 401, headers: noStore },
    );
  if (new URL(request.url).searchParams.get("active") === "1") {
    const session = issueSession();
    if (session)
      (await cookies()).set(
        SESSION_COOKIE,
        session.value,
        sessionCookieOptions(session.maxAge),
      );
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
