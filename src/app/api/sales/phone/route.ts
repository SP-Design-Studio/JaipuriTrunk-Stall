import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { PHONE_HINT, normalizePhone } from "@/lib/phone";
import { withProof } from "@/lib/receiptlink";
import { available, findSale, updateSalePhone } from "@/lib/store";

/**
 * Staff correct a customer's phone number on a bill (a typo, or a number that was
 * entered before other countries were supported). It changes the number and
 * nothing else: no amounts, no items, no bill number. Session required.
 *
 * `alsoSameNumber` fixes every other bill that carries the same wrong number too,
 * since one customer's repeat purchases usually carry the same slip.
 */
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Bad origin." }, 403);
  if (!requestHasSession(request))
    return reply({ error: "Sign in again." }, 401);
  if (!available()) return reply({ error: "storage-not-configured" }, 503);

  let body: { saleId?: unknown; phone?: unknown; alsoSameNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Malformed request." }, 400);
  }
  if (typeof body.saleId !== "string" || !UUID.test(body.saleId))
    return reply({ error: "Bad bill." }, 400);
  if (typeof body.phone !== "string")
    return reply({ error: "Bad number." }, 400);
  const raw = body.phone.trim();
  const phone = raw === "" ? "" : normalizePhone(raw);
  if (phone === null) return reply({ error: `Phone: ${PHONE_HINT}.` }, 400);

  try {
    const id = body.saleId.toLowerCase();
    const sale = await findSale(id);
    if (!sale) return reply({ error: "Not found." }, 404);
    // Someone who agreed to be messaged needs a number to be messaged on.
    if (phone === "" && sale.marketingOk)
      return reply(
        { error: "They agreed to be messaged, so the bill needs a number." },
        400,
      );
    const changed = await updateSalePhone(
      id,
      phone,
      body.alsoSameNumber === true,
    );
    return reply({ ok: true, sales: changed.map(withProof) });
  } catch (err) {
    console.error("[stall] could not update the phone number:", err);
    return reply({ error: "Could not save the number." }, 502);
  }
}
