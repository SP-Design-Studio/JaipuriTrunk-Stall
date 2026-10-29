import { NextResponse } from "next/server";
import { noStore, requestHasSession } from "@/lib/guard";
import { available, listReviews, listReviewStatus } from "@/lib/store";

/** The reviews and who was asked, skipped or nudged, for staff in Sales. Session required. */
export async function GET(request: Request) {
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: noStore });
  if (!requestHasSession(request))
    return reply({ error: "Sign in again." }, 401);
  if (!available()) return reply({ error: "storage-not-configured" }, 503);
  try {
    const reviews = await listReviews();
    // Prompt tracking is optional: without migration 0006 the reviews still show.
    let statuses: Awaited<ReturnType<typeof listReviewStatus>> = [];
    try {
      statuses = await listReviewStatus();
    } catch (err) {
      console.error("[stall] could not read review status:", err);
    }
    return reply({ reviews, statuses });
  } catch (err) {
    console.error("[stall] could not list reviews:", err);
    return reply({ error: "Could not load reviews." }, 502);
  }
}
