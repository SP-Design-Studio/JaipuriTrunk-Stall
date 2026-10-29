import type { Review, ReviewStatus, Sale } from "./types";

/**
 * Where a bill stands with its review, from the review itself and the prompt
 * tracking. A review beats everything: a customer who skipped and later wrote one
 * counts as reviewed, which is the point of sending the link again.
 *
 *   reviewed   wrote a review
 *   skipped    saw the prompt on the bill and tapped Skip
 *   requested  staff sent them the review link on WhatsApp
 *   seen       the prompt was shown but they did nothing yet
 *   none       not asked yet (bill never opened, or opened before tracking)
 */
export type ReviewState =
  | { kind: "reviewed"; rating: number; at: string }
  | { kind: "skipped" | "requested" | "seen"; at: string }
  | { kind: "none" };

export function reviewState(
  sale: Sale,
  reviews: Map<string, Review>,
  statuses: Map<string, ReviewStatus>,
): ReviewState {
  const r = reviews.get(sale.id);
  if (r) return { kind: "reviewed", rating: r.rating, at: r.createdAt };
  const s = statuses.get(sale.id);
  if (!s) return { kind: "none" };
  // The most recent thing that happened decides: skipped, then re-requested, is
  // "requested" until they act again.
  const events = (
    [
      ["skipped", s.skippedAt],
      ["requested", s.requestedAt],
      ["seen", s.askedAt],
    ] as const
  )
    .filter(
      (e): e is readonly ["skipped" | "requested" | "seen", string] => !!e[1],
    )
    .sort((a, b) => b[1].localeCompare(a[1]));
  return events[0]
    ? { kind: events[0][0], at: events[0][1] }
    : { kind: "none" };
}

/** Words for staff. */
export function describe(
  state: ReviewState,
  when: (iso: string) => string,
): string {
  switch (state.kind) {
    case "reviewed":
      return `Reviewed ${"★".repeat(state.rating)}`;
    case "skipped":
      return `Skipped on ${when(state.at)}`;
    case "requested":
      return `Link sent on ${when(state.at)}`;
    case "seen":
      return `Saw the prompt on ${when(state.at)}`;
    default:
      return "Not asked yet";
  }
}
