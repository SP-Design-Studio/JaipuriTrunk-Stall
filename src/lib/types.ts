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
};

export type Discount =
  | { kind: "none" }
  | { kind: "pct"; value: number }
  /** Knock off the odd rupees so the total lands on a multiple of ₹10. */
  | { kind: "round10" }
  | { kind: "flat"; value: number };

export type PaymentMode = "UPI" | "Cash";

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
};

export type Sale = SaleInput & {
  subtotal: number;
  discountAmount: number;
  total: number;
  /** Added by the server on the way out (see receiptlink.ts); never stored. */
  receiptPath?: string;
  verifyCode?: string;
};
