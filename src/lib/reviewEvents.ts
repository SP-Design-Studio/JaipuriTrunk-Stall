/**
 * Tells the server what happened to the review prompt on this bill, from the
 * customer's phone. Fire and forget: tracking must never slow down or break
 * what the customer is looking at, so every failure is swallowed.
 */
export function sendReviewEvent(token: string, event: "asked" | "skipped") {
  try {
    void fetch("/api/review/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nothing to do.
  }
}
