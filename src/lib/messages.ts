import { inr } from "./money";
import { BUSINESS, LAUNCH_LABEL, PROMO } from "./config";
import type { Sale } from "./types";

/**
 * Opens the WhatsApp app directly. `whatsapp://send` skips the wa.me web page
 * that asks "Open in WhatsApp?" first. It does nothing if the app isn't
 * installed, so `waWebLink` is kept as the fallback. Both want the country
 * code and digits only; these are Indian mobile numbers.
 */
export const waLink = (phone: string, text: string) =>
  `whatsapp://send?phone=91${phone}&text=${encodeURIComponent(text)}`;

export const waWebLink = (phone: string, text: string) =>
  `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;

/**
 * The WhatsApp messages the till writes, as templates the owner can edit in
 * Settings. A template is plain text with {placeholders}:
 *
 *   {name} {bill} {total} {payment} {link} {review} {stall} {business} {website}
 *   {instagram}
 *
 * A line whose {link}, {review}, {stall} or {instagram} has nothing to fill it is dropped whole,
 * rather than sent as "View your receipt: ". {name} falls back to "there".
 */
export type Templates = {
  receipt: string;
  followUp: string;
  /** Asking for a review, sent from a bill. Older saved lists lack it. */
  reviewAsk?: string;
};

/** Every message filled in, with the standard wording for any that were never saved. */
export const fullTemplates = (
  saved: Templates | null,
): Required<Templates> => ({
  ...defaultTemplates(),
  ...(saved ?? {}),
});

export const PLACEHOLDERS = [
  ["{name}", "customer’s name"],
  ["{bill}", "bill number"],
  ["{total}", "amount paid"],
  ["{payment}", "UPI or Cash"],
  ["{link}", "their receipt link"],
  ["{review}", "their review link"],
  ["{stall}", "which stall"],
  ["{business}", "shop name"],
  ["{website}", "website"],
  ["{instagram}", "Instagram"],
] as const;

export const MAX_TEMPLATE = 1000;

export function defaultTemplates(): Required<Templates> {
  return {
    receipt: [
      `Hi {name}! Thank you for shopping at the {business} stall.`,
      `Receipt {bill}: {total} paid by {payment}.`,
      `View or download your receipt: {link}`,
      PROMO ? `${PROMO.blurb} Use code ${PROMO.code} at {website}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    reviewAsk: [
      `Hi {name}! Thanks for shopping at the {business} stall.`,
      `How was it? Tell us in ten seconds: {review}`,
    ].join("\n"),
    followUp: [
      `Hi {name}! Thanks for stopping by the {business} stall.`,
      LAUNCH_LABEL
        ? `Our online shop opens in ${LAUNCH_LABEL} — {website}`
        : `Our online shop is opening soon — {website}`,
      `Instagram: {instagram}`,
    ].join("\n"),
  };
}

type Vars = {
  name?: string;
  bill?: string;
  total?: string;
  payment?: string;
  link?: string;
  review?: string;
  stall?: string;
};

export function render(template: string, v: Vars): string {
  const values: Record<string, string> = {
    name: v.name?.trim() || "there",
    bill: v.bill ?? "",
    total: v.total ?? "",
    payment: v.payment ?? "",
    link: v.link ?? "",
    review: v.review ?? "",
    stall: v.stall ?? "",
    business: BUSINESS.name,
    website: BUSINESS.website,
    instagram: BUSINESS.instagram,
  };
  return template
    .split("\n")
    .filter((line) => {
      const used = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      // A line that leans on a value we don't have says nothing useful.
      return !used.some(
        (k) =>
          (k === "link" ||
            k === "review" ||
            k === "instagram" ||
            k === "stall") &&
          !values[k],
      );
    })
    .join("\n")
    .replace(/\{(\w+)\}/g, (all, k: string) => (k in values ? values[k] : all));
}

export function receiptText(
  sale: Sale,
  link?: string,
  templates?: Templates | null,
  reviewLink?: string,
): string {
  return render((templates ?? defaultTemplates()).receipt, {
    review: reviewLink,
    name: sale.customerName,
    bill: sale.invoiceNo,
    total: inr(sale.total),
    payment: sale.paymentMode,
    stall: sale.stall?.name,
    link,
  });
}

/** Only ever sent to someone who ticked the consent box. */
export function followUpText(
  name: string,
  templates?: Templates | null,
): string {
  return render((templates ?? defaultTemplates()).followUp, { name });
}

/** The message that asks a buyer for a review, from a bill. */
export function reviewText(
  sale: Sale,
  reviewLink?: string,
  templates?: Templates | null,
): string {
  return render(fullTemplates(templates ?? null).reviewAsk, {
    name: sale.customerName,
    bill: sale.invoiceNo,
    total: inr(sale.total),
    payment: sale.paymentMode,
    stall: sale.stall?.name,
    review: reviewLink,
  });
}
