/**
 * The stall's identity, as it prints on a receipt.
 *
 * Empty strings are omitted from the receipt rather than printed as blanks, so
 * fill in only what is true. Nothing here is invented: the prototype this was
 * built from carried a made-up address and a "FLEA10" promo code for a shop that
 * does not take online orders yet, and a receipt that promises a discount nobody
 * can redeem is worse than one that promises nothing.
 *
 * This app is deliberately separate from the JaipuriTrunk website and shares no
 * code with it, so the few facts it needs live here. If the brand's tagline or
 * handle changes on the site, change it here too.
 */
export const BUSINESS = {
  name: "JaipuriTrunk",
  tagline: "Handpicked in Jaipur. Unpacked in Hyderabad.",
  /** e.g. "Stall 14, Lamakaan, Road No. 1, Banjara Hills, Hyderabad". */
  address: "",
  /** Printed under the address. A WhatsApp or call number the customer can reach. */
  phone: "",
  /** If registered. Printed as given; no tax breakdown is computed from it. */
  gstin: "",
  instagram: "@jaipuri_trunk",
  website: "jaipuritrunk.com",
  thanks: "Thank you for shopping with us.",
} as const;

/**
 * A discount code honoured on the website. Leave null until the shop actually
 * accepts one — when set, it is printed on the receipt and in the WhatsApp text.
 */
export const PROMO: { code: string; blurb: string } | null = null;

/**
 * When the online shop opens, e.g. "December 2026". Left empty on purpose: the
 * launch date has already moved once, and a receipt or message that states a
 * stale date is worse than one that says "soon". Set it when it is final.
 */
export const LAUNCH_LABEL = "";
