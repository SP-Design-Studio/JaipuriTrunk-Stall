/**
 * Customer phone numbers, for any country.
 *
 * Two stored forms, so nothing already saved has to change:
 *   9876543210       an Indian mobile, 10 digits (what the till stored before)
 *   +14155552671     anything else: "+", the country code, then the number
 *
 * Typed freely: spaces, dashes, dots and brackets are ignored; "00" counts as
 * "+"; and "+91 98765 43210" or "91 98765 43210" is the same Indian number as
 * "98765 43210". Anything outside India must start with "+" and the country code,
 * because a bare number can't say which country it is.
 */
export const PHONE_HINT =
  "10-digit Indian mobile, or an international number starting with + and the country code (e.g. +1 415 555 2671)";

export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  if (/^[6-9]\d{9}$/.test(s)) return s;
  // India written with its country code, with or without the "+".
  const india = /^\+?91([6-9]\d{9})$/.exec(s);
  if (india) return india[1];

  if (!s.startsWith("+")) return null;
  const digits = s.slice(1);
  // International numbers are at most 15 digits, and never start with 0.
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** The digits WhatsApp wants: country code and number, no "+". */
export const whatsappNumber = (stored: string) =>
  stored.startsWith("+") ? stored.slice(1) : `91${stored}`;
