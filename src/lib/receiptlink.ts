import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sale } from "./types";

/**
 * Two things hang off a stored sale, both derived from a secret rather than
 * stored, so they need no extra column and cannot be guessed:
 *
 *   link    /r/<sale id>.<signature>   the customer's own copy of the receipt,
 *                                      which stays valid for as long as the sale
 *                                      is in the database
 *   code    ABCD-2345                  printed on the receipt; staff type it in
 *                                      with the bill number to confirm a receipt
 *                                      is genuine and see what the record says
 *
 * RECEIPT_SECRET is separate from the login secret on purpose: changing the
 * login secret signs the till out, and must not break every link already sent
 * to a customer. Rotating THIS one does break them, so it is set once.
 */
const secret = () => {
  const s = process.env.RECEIPT_SECRET;
  if (s && s.length >= 32) return s;
  // Development only: a fixed fallback beats a till that cannot be tried.
  // Production without the secret simply has no links or codes.
  return process.env.NODE_ENV !== "production"
    ? "development-only-receipt-secret-not-for-production"
    : null;
};

export const proofConfigured = () => secret() !== null;

const mac = (label: string, value: string) => {
  const s = secret();
  return s ? createHmac("sha256", s).update(`${label}:${value}`) : null;
};

export function linkPath(id: string): string | null {
  const h = mac("link", id);
  return h ? `/r/${id}.${h.digest("base64url").slice(0, 22)}` : null;
}

/** The customer's review page for the same bill: the receipt link plus /review. */
export function reviewPath(id: string): string | null {
  const p = linkPath(id);
  return p ? `${p}/review` : null;
}

/** The sale id behind a link, or null if the signature is wrong. */
export function idFromToken(token: string): string | null {
  const at = token.lastIndexOf(".");
  if (at < 1) return null;
  const id = token.slice(0, at);
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = linkPath(id)?.slice(3);
  if (!want) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Ties the number, the amount and the time together: change any and it changes. */
export function verifyCodeFor(sale: Sale): string | null {
  const h = mac(
    "code",
    [sale.id, sale.invoiceNo, sale.total, sale.createdAt].join("|"),
  );
  if (!h) return null;
  const bytes = h.digest();
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function codesMatch(sale: Sale, typed: string): boolean {
  const want = verifyCodeFor(sale);
  const got = typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!want) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want.replace("-", ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What the till gets back: the sale plus its link and code. */
export function withProof(sale: Sale): Sale {
  return {
    ...sale,
    receiptPath: linkPath(sale.id) ?? undefined,
    reviewPath: reviewPath(sale.id) ?? undefined,
    verifyCode: verifyCodeFor(sale) ?? undefined,
  };
}
