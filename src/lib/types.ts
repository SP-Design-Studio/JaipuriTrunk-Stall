/**
 * Shapes shared by the till, the API and the database mapping.
 *
 * Money is whole rupees throughout. A stall sells at ₹299 and ₹1,299, not
 * ₹299.50, and integers cannot drift the way floats do when you add and
 * discount them — the receipt, the server's recomputation and the CSV all have
 * to agree to the rupee.
 */

export type Line = {
  /** Merges identical taps: same item, size and price become one line. */
  key: string;
  name: string;
  price: number;
  qty: number;
  size?: string;
  color?: string;
  /** The catalogue item it came from, so selling it can lower that item's stock.
   *  Absent on one-off "other item" lines and on bills from before stock. */
  itemId?: string;
};

export type Discount =
  | { kind: "none" }
  | { kind: "pct"; value: number }
  /** Knock off the odd rupees so the total lands on a multiple of ₹10. */
  | { kind: "round10" }
  | { kind: "flat"; value: number };

export type PaymentMode = "UPI" | "Cash";

/**
 * Which stall a sale was rung up at. A copy is kept on the sale itself, so a
 * receipt keeps the name and address it was printed with even if the stall is
 * later renamed or removed from the list.
 */
export type Stall = {
  name: string;
  address: string;
  phone: string;
  /** The days it runs, as YYYY-MM-DD. The same day twice means a one-day stall. */
  from?: string;
  to?: string;
};

/** A stall in the list staff choose from in Settings. */
export type StallEntry = Stall & { id: string };

/** What the till sends. Totals are deliberately absent: the server owns them. */
export type SaleInput = {
  /** Client-generated, so a retried upload is recognised as the same sale. */
  id: string;
  invoiceNo: string;
  createdAt: string;
  customerName: string;
  /** Ten digits, or empty for a walk-in who would rather not say. */
  customerPhone: string;
  /** Said yes to being messaged about launches. Never assumed. */
  marketingOk: boolean;
  lines: Line[];
  discount: Discount;
  paymentMode: PaymentMode;
  /** Absent on bills made before stalls existed, or when no stalls are set up. */
  stall?: Stall;
};

export type Sale = SaleInput & {
  subtotal: number;
  discountAmount: number;
  total: number;
  /** Added by the server on the way out (see receiptlink.ts); never stored. */
  receiptPath?: string;
  /** The customer's review link for this bill (the receipt link + /review). */
  reviewPath?: string;
  verifyCode?: string;
};

/** A buyer's review of one bill. */
export type Review = {
  saleId: string;
  rating: number;
  comment: string;
  /** Ticked "OK to show this publicly with my first name". */
  showPublic: boolean;
  /** From the bill, on the server. */
  firstName: string;
  invoiceNo: string;
  stallName: string;
  createdAt: string;
};

/** What happened to the review prompt on one bill (see migration 0006). */
export type ReviewStatus = {
  saleId: string;
  askedAt: string | null;
  skippedAt: string | null;
  requestedAt: string | null;
};

export type ReviewEvent = "asked" | "skipped" | "requested";
