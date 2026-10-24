/**
 * Made-up prices, for trying the till out before real ones are set.
 *
 * ON in development (`npm run dev`). In a production build they are OFF unless
 * NEXT_PUBLIC_STALL_TEST_PRICES=1 is set — which is how a Vercel preview can be
 * tested on the iPad with prices in place, while the real deployment, which
 * never sets it, can never ship a guess as a price.
 *
 * Derived from the item's id rather than drawn with Math.random: random values
 * would differ on every reload and between server and browser, so a price would
 * change under your finger. This gives each item a price that merely looks
 * random — a multiple of ₹10 between ₹500 and ₹1,000 — and keeps it.
 */
export const TEST_PRICES =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_STALL_TEST_PRICES === "1";

export function testPrice(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 500 + ((h >>> 0) % 51) * 10;
}
