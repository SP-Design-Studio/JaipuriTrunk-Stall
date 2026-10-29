import { NextResponse } from "next/server";
import { noStore, sameOrigin } from "@/lib/guard";
import { idFromToken } from "@/lib/receiptlink";
import { available, findSale, markReviewEvent } from "@/lib/store";

/**
 * The customer's side of the review prompt: "the review screen was shown" and "they
 * tapped Skip". Same credential as the review itself, the signed receipt token.
 * It only stamps a time on the bill, so staff can tell who skipped from who has
 * not opened their bill. Failing quietly is fine: tracking must never get in the
 * way of the customer seeing their bill.
 */
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Bad origin." }, 403);
  let body: { token?: unknown; event?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Malformed request." }, 400);
  }
  if (body.event !== "asked" && body.event !== "skipped")
    return reply({ error: "Bad event." }, 400);
  const id =
    typeof body.token === "string" && body.token.length < 200
      ? idFromToken(body.token)
      : null;
  if (!id || !available()) return reply({ error: "Not found." }, 404);
  try {
    if (!(await findSale(id))) return reply({ error: "Not found." }, 404);
    await markReviewEvent(id, body.event);
    return reply({ ok: true });
  } catch (err) {
    console.error("[stall] could not record review event:", err);
    return reply({ ok: false });
  }
}
