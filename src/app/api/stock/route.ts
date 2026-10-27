import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, getStock, setStock } from "@/lib/store";

/**
 * Stock counts per item. Selling lowers them (in the sales route); this is for
 * reading them and for staff setting a count. Staff only.
 */
const ID = /^[a-z0-9-]{1,40}$/i;
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    return NextResponse.json({ stock: await getStock() }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not read stock:", err);
    return fail("Could not load stock.", 502);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail("Bad origin.", 403);
  if (!requestHasSession(request)) return fail("Sign in again.", 401);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("Send JSON.", 415);
  let body: { itemId?: unknown; quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Malformed request.", 400);
  }
  const { itemId, quantity } = body;
  if (typeof itemId !== "string" || !ID.test(itemId))
    return fail("Bad item.", 400);
  // A whole number from 0, or null to stop counting this item.
  if (
    quantity !== null &&
    (typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 100_000)
  )
    return fail("Stock must be a whole number from 0 to 100,000.", 400);
  if (!available()) return fail("storage-not-configured", 503);
  try {
    await setStock(itemId, quantity as number | null);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not set stock:", err);
    return fail("Could not save the stock.", 502);
  }
}
