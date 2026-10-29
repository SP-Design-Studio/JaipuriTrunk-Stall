import { NextResponse } from "next/server";
import { noStore, sameOrigin } from "@/lib/guard";
import { idFromToken } from "@/lib/receiptlink";
import { available, findSale, insertReview } from "@/lib/store";
import { parseReview } from "@/lib/validate";

/**
 * A buyer's review. No login: the signed receipt link is the credential. It
 * proves the sender holds a real bill, and a bill can be reviewed once, so there
 * is nothing to guess and nothing to spam beyond the bills that exist. A wrong or
 * altered token is a plain 404, like the receipt page.
 *
 * The name on the review is taken from the bill here, never from the request.
 */
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Bad origin." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "Send JSON." }, 415);

  let body: { token?: unknown } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Malformed request." }, 400);
  }

  const id =
    typeof body.token === "string" && body.token.length < 200
      ? idFromToken(body.token)
      : null;
  if (!id || !available()) return reply({ error: "Not found." }, 404);

  const parsed = parseReview(body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);

  try {
    const sale = await findSale(id);
    if (!sale) return reply({ error: "Not found." }, 404);
    const result = await insertReview({
      saleId: sale.id,
      rating: parsed.rating,
      comment: parsed.comment,
      showPublic: parsed.showPublic,
      // Only the first word of the name, and only used if they opted in to show it.
      firstName: sale.customerName.trim().split(/\s+/)[0] ?? "",
      invoiceNo: sale.invoiceNo,
      stallName: sale.stall?.name ?? "",
      createdAt: "",
    });
    if (result === "exists")
      return reply({ error: "You have already reviewed this bill." }, 409);
    return reply({ ok: true });
  } catch (err) {
    console.error("[stall] could not save review:", err);
    return reply(
      { error: "Could not save your review. Please try again." },
      502,
    );
  }
}
