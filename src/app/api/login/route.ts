import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { noStore, sameOrigin } from "@/lib/guard";
import {
  SESSION_COOKIE,
  checkCredentials,
  issueSession,
  posConfigured,
} from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Bad origin." },
      { status: 403, headers: noStore },
    );
  }
  if (!posConfigured()) {
    // Says nothing about WHICH variable, so this cannot be used to probe.
    return NextResponse.json(
      { error: "The till is not set up on this deployment." },
      { status: 503, headers: noStore },
    );
  }

  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: noStore },
    );
  }

  const ok =
    typeof email === "string" &&
    typeof password === "string" &&
    email.length <= 254 &&
    password.length <= 256 &&
    checkCredentials(email, password);

  if (!ok) {
    /**
     * A flat delay on every failure, and one message for every kind of wrong.
     *
     * Serverless instances share no memory, so a counter here would reset
     * whenever Vercel starts another one and would stop nothing. What actually
     * limits guessing is Vercel's firewall rate limit on this path; the delay
     * just makes each attempt cost something in the meantime.
     */
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json(
      { error: "That email and password don't match." },
      { status: 401, headers: noStore },
    );
  }

  const session = issueSession()!;
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
