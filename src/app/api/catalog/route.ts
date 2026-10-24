import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { getCatalog, putCatalog, available } from "@/lib/store";
import { parseCatalog } from "@/lib/validate";

/** Same rules as /api/sales: the session is checked here, next to the data. */

export async function GET(request: Request) {
  if (!requestHasSession(request)) {
    return NextResponse.json(
      { error: "Sign in again." },
      { status: 401, headers: noStore },
    );
  }
  if (!available()) {
    return NextResponse.json(
      { error: "storage-not-configured" },
      { status: 503, headers: noStore },
    );
  }
  try {
    // `catalog: null` means nothing has been saved yet, so the till keeps its
    // starter list rather than being told to adopt an empty one.
    const found = await getCatalog();
    return NextResponse.json(
      { catalog: found?.catalog ?? null, updatedAt: found?.updatedAt ?? null },
      { headers: noStore },
    );
  } catch (err) {
    console.error("[stall] could not read catalog:", err);
    return NextResponse.json(
      { error: "Could not load the list." },
      { status: 502, headers: noStore },
    );
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Bad origin." },
      { status: 403, headers: noStore },
    );
  }
  if (!requestHasSession(request)) {
    return NextResponse.json(
      { error: "Sign in again." },
      { status: 401, headers: noStore },
    );
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "Send JSON." },
      { status: 415, headers: noStore },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: noStore },
    );
  }

  const parsed = parseCatalog(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: noStore },
    );
  }
  if (!available()) {
    return NextResponse.json(
      { error: "storage-not-configured" },
      { status: 503, headers: noStore },
    );
  }

  try {
    const updatedAt = await putCatalog(parsed.catalog);
    return NextResponse.json({ ok: true, updatedAt }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not save catalog:", err);
    return NextResponse.json(
      { error: "Could not save the list." },
      { status: 502, headers: noStore },
    );
  }
}
