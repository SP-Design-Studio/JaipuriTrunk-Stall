import { NextResponse } from "next/server";
import { noStore, requestHasSession } from "@/lib/guard";
import { available, listReviews } from "@/lib/store";

/** The reviews, for staff in the Sales tab. Session required. */
export async function GET(request: Request) {
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: noStore });
  if (!requestHasSession(request))
    return reply({ error: "Sign in again." }, 401);
  if (!available()) return reply({ error: "storage-not-configured" }, 503);
  try {
    return reply({ reviews: await listReviews() });
  } catch (err) {
    console.error("[stall] could not list reviews:", err);
    return reply({ error: "Could not load reviews." }, 502);
  }
}
