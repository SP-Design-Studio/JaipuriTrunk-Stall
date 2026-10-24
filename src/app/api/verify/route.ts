import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { codesMatch } from "@/lib/receiptlink";
import { available, findByInvoice } from "@/lib/store";

/**
 * Staff check of a receipt: the bill number and the code printed under it. A
 * wrong number and a wrong code get the same answer, so this cannot be used to
 * find out which bill numbers exist. Signed-in staff only.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Bad origin." },
      { status: 403, headers: noStore },
    );
  if (!requestHasSession(request))
    return NextResponse.json(
      { error: "Sign in again." },
      { status: 401, headers: noStore },
    );
  if (!available())
    return NextResponse.json(
      { error: "storage-not-configured" },
      { status: 503, headers: noStore },
    );

  let body: { invoiceNo?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: noStore },
    );
  }
  const invoiceNo =
    typeof body.invoiceNo === "string"
      ? body.invoiceNo.trim().toUpperCase()
      : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^JT-\d{8}-\d{6}-\d{4,}$/.test(invoiceNo) || code.length > 20)
    return NextResponse.json({ genuine: false }, { headers: noStore });

  try {
    const sale = await findByInvoice(invoiceNo);
    if (!sale || !codesMatch(sale, code))
      return NextResponse.json({ genuine: false }, { headers: noStore });
    return NextResponse.json({ genuine: true, sale }, { headers: noStore });
  } catch (err) {
    console.error("[stall] could not verify:", err);
    return NextResponse.json(
      { error: "Could not check." },
      { status: 502, headers: noStore },
    );
  }
}
