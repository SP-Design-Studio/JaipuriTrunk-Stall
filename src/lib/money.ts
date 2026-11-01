import type { Discount, Line } from "./types";

const group = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,299 and ₹1,24,999 — Indian lakh grouping, which `en-US` would get wrong. */
export const inr = (n: number) => `₹${group.format(n)}`;

/**
 * ₹1.23 L and ₹4.5 Cr for big amounts, where space is tight (phone cards); under a
 * lakh it is the plain figure. The full figure always stays available elsewhere.
 */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${Number((a / 1e7).toFixed(2))} Cr`;
  if (a >= 1e5) return `${sign}₹${Number((a / 1e5).toFixed(2))} L`;
  return inr(n);
}

/** A share as a whole percent, but "<1%" rather than a misleading "0%" for a sliver. */
export function shareText(part: number, whole: number): string {
  if (!whole) return "0%";
  const p = (part / whole) * 100;
  return part > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

export const lineTotal = (l: Pick<Line, "price" | "qty">) => l.price * l.qty;

export const subtotalOf = (lines: Pick<Line, "price" | "qty">[]) =>
  lines.reduce((sum, l) => sum + lineTotal(l), 0);

export function discountAmount(subtotal: number, d: Discount): number {
  switch (d.kind) {
    case "none":
      return 0;
    case "pct":
      return Math.round((subtotal * d.value) / 100);
    case "round10":
      return subtotal % 10;
    case "flat":
      // Never more than the bill: a ₹500 "discount" on ₹300 must not produce a
      // negative total that the books then have to explain.
      return Math.min(subtotal, Math.max(0, Math.floor(d.value)));
  }
}

/**
 * The single place totals are computed.
 *
 * Imported by the till (to show the figure) and by the API route (to overwrite
 * whatever the client claimed), so a doctored request cannot record a sale for
 * a different amount than the items add up to.
 */
export function totalsFor(lines: Pick<Line, "price" | "qty">[], d: Discount) {
  const subtotal = subtotalOf(lines);
  const discount = discountAmount(subtotal, d);
  return { subtotal, discountAmount: discount, total: subtotal - discount };
}

export function describeDiscount(d: Discount): string {
  switch (d.kind) {
    case "none":
      return "";
    case "pct":
      return `${d.value}% off`;
    case "round10":
      return "Rounded off";
    case "flat":
      return "Discount";
  }
}

/** "UK 6 · Maroon", or "" when the item has neither. */
export const variantOf = (l: { size?: string; color?: string }) =>
  [l.size, l.color].filter(Boolean).join(" · ");
