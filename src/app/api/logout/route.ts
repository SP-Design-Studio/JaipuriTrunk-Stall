import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { noStore, sameOrigin } from "@/lib/guard";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Bad origin." },
      { status: 403, headers: noStore },
    );
  }
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
