import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

/** For server components and layouts. */
export async function hasSession(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For route handlers, which the proxy deliberately does not cover. */
export function requestHasSession(req: Request): boolean {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`),
  );
  return verifySession(match?.[1]);
}

/**
 * Rejects a cross-site POST.
 *
 * `SameSite=Lax` already stops the cookie riding along on one, and every body
 * here must be JSON, which a plain cross-site form cannot send. This is the
 * third, cheapest layer: if a browser tells us the request came from somewhere
 * else, believe it. A missing Origin (curl, some older clients) is let through,
 * because the cookie check still has to pass.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const noStore = { "cache-control": "no-store" } as const;
