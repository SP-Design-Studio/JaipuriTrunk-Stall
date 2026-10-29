import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, findSale, markReviewEvent } from "@/lib/store";

/** Staff: "I sent this customer the review link on WhatsApp". Session required. */
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Bad origin." }, 403);
  if (!requestHasSession(request))
    return reply({ error: "Sign in again." }, 401);
  if (!available()) return reply({ error: "storage-not-configured" }, 503);
  let body: { saleId?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Malformed request." }, 400);
  }
  if (typeof body.saleId !== "string" || !UUID.test(body.saleId))
    return reply({ error: "Bad bill." }, 400);
  try {
    if (!(await findSale(body.saleId.toLowerCase())))
      return reply({ error: "Not found." }, 404);
    await markReviewEvent(body.saleId.toLowerCase(), "requested");
    return reply({ ok: true });
  } catch (err) {
    console.error("[stall] could not record review request:", err);
    return reply({ error: "Could not record that." }, 502);
  }
}
