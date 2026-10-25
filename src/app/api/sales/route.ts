import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { passwordMatches } from "@/lib/session";
import { available, deleteAllSales, insertSale, listSales } from "@/lib/store";
import { withProof } from "@/lib/receiptlink";
import { parseSale } from "@/lib/validate";

/**
 * Both handlers check the session themselves. The proxy only redirects pages;
 * it is told to skip /api, and even where it runs it is a convenience, not
 * the lock — the check belongs next to the data.
 */

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
    return NextResponse.json(
      { sales: (await listSales()).map(withProof) },
      { headers: noStore },
    );
  } catch (err) {
    console.error("[stall] could not list sales:", err);
    return NextResponse.json(
      { error: "Could not load sales." },
      { status: 502, headers: noStore },
    );
  }
}

export async function POST(request: Request) {
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

  const parsed = parseSale(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: noStore },
    );
  }

  // No database in a production deployment. The till has already refused to
  // open for this reason; this is the same answer for anything that asks anyway.
  if (!available()) {
    return NextResponse.json(
      { error: "storage-not-configured" },
      { status: 503, headers: noStore },
    );
  }

  try {
    const stored = await insertSale(parsed.sale);
    if (stored === "busy") {
      return NextResponse.json(
        { error: "Busy numbering the bill. Try again." },
        { status: 409, headers: noStore },
      );
    }
    // The stored sale, not the one sent: it carries the bill number.
    return NextResponse.json(
      { ok: true, sale: withProof(stored) },
      { headers: noStore },
    );
  } catch (err) {
    console.error("[stall] could not store sale:", err);
    return NextResponse.json(
      { error: "Could not save the sale." },
      { status: 502, headers: noStore },
    );
  }
}

/**
 * Deletes every sale, and with them the bill count: the next bill is 0001 again.
 * Permanent, and these are tax records, so it asks for the login password again
 * and the word DELETE, on top of being signed in.
 */
export async function DELETE(request: Request) {
  const reply = (error: string, status: number) =>
    NextResponse.json({ error }, { status, headers: noStore });
  if (!sameOrigin(request)) return reply("Bad origin.", 403);
  if (!requestHasSession(request)) return reply("Sign in again.", 401);
  let body: { password?: unknown; confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply("Malformed request.", 400);
  }
  if (body.confirm !== "DELETE") return reply("Type DELETE to confirm.", 400);
  if (typeof body.password !== "string" || !passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 700));
    return reply("That password isn’t right.", 403);
  }
  if (!available()) return reply("storage-not-configured", 503);
  try {
    await deleteAllSales();
    console.warn("[stall] all sales deleted by the signed-in user");
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not delete sales:", err);
    return reply("Could not delete the bills.", 502);
  }
}
