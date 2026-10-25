import { NextResponse } from "next/server";
import { noStore, requestHasSession, sameOrigin } from "@/lib/guard";
import { available, restoreSale } from "@/lib/store";
import { parseSale } from "@/lib/validate";

/**
 * Puts bills back from a backup file. Every bill is checked like a new sale
 * (and its totals recomputed), keeps the bill number it had, and is skipped if
 * that bill is already here, so importing the same file twice changes nothing.
 * Signed-in staff only; the till sends the file in small batches.
 */
const MAX_BATCH = 200;

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: noStore });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Bad origin." }, 403);
  if (!requestHasSession(request))
    return reply({ error: "Sign in again." }, 401);
  if (!available()) return reply({ error: "storage-not-configured" }, 503);

  let body: { sales?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Malformed request." }, 400);
  }
  if (!Array.isArray(body.sales) || body.sales.length > MAX_BATCH)
    return reply({ error: `Send up to ${MAX_BATCH} bills at a time.` }, 400);

  const out = { added: 0, skipped: 0, conflicts: 0, rejected: 0 };
  try {
    for (const raw of body.sales) {
      const parsed = parseSale(raw, true);
      if (!parsed.ok) {
        out.rejected += 1;
        continue;
      }
      const r = await restoreSale(parsed.sale);
      if (r === "added") out.added += 1;
      else if (r === "skipped") out.skipped += 1;
      else out.conflicts += 1;
    }
  } catch (err) {
    console.error("[stall] restore failed part-way:", err);
    return reply({ error: "Couldn’t finish restoring.", ...out }, 502);
  }
  return reply(out);
}
