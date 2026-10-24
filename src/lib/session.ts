import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The till's login: one email and password from the environment, and a signed,
 * expiring cookie once they are right. No user table, no third party.
 *
 *   POS_EMAIL            who may sign in
 *   POS_PASSWORD         their password — compared, never stored or logged
 *   POS_SESSION_SECRET   32+ random characters; signs the cookie
 *   POS_SESSION_HOURS    optional, default 12
 *
 * If any of the first three is missing the till refuses to open at all rather
 * than falling back to something guessable.
 */
export const SESSION_COOKIE = "jts_session";

function creds() {
  const email = process.env.POS_EMAIL?.trim().toLowerCase();
  const password = process.env.POS_PASSWORD;
  const secret = process.env.POS_SESSION_SECRET;
  if (!email || !password || !secret || secret.length < 32) return null;
  return { email, password, secret };
}

export const posConfigured = () => creds() !== null;

function hours() {
  const n = Number(process.env.POS_SESSION_HOURS);
  return Number.isFinite(n) && n > 0 && n <= 24 * 30 ? n : 12;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Compared as SHA-256 digests so both sides are always 32 bytes — `timingSafeEqual`
 * throws on unequal lengths, and a length check first would leak the length.
 */
const safeEqual = (a: string, b: string) =>
  timingSafeEqual(digest(a), digest(b));

export function checkCredentials(email: string, password: string): boolean {
  const c = creds();
  if (!c) return false;
  // Both comparisons always run: `&&` on the results would skip the password
  // check for a wrong email and make the two cases measurably different.
  const emailOk = safeEqual(email.trim().toLowerCase(), c.email);
  const passwordOk = safeEqual(password, c.password);
  return emailOk && passwordOk;
}

/**
 * The password's hash is part of what is signed, so changing POS_PASSWORD
 * invalidates every session already issued. That is the "sign everyone out"
 * button, and it costs nothing because there is no session table to purge.
 */
function sign(exp: number, c: NonNullable<ReturnType<typeof creds>>) {
  return createHmac("sha256", c.secret)
    .update(`${exp}:${digest(c.password).toString("hex")}`)
    .digest("base64url");
}

export function issueSession(now = Date.now()) {
  const c = creds();
  if (!c) return null;
  const nowSec = Math.floor(now / 1000);
  const exp = nowSec + Math.round(hours() * 3600);
  return { value: `${exp}.${sign(exp, c)}`, maxAge: exp - nowSec };
}

export function verifySession(
  token: string | undefined | null,
  now = Date.now(),
): boolean {
  const c = creds();
  if (!c || !token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig) return false;
  if (exp <= Math.floor(now / 1000)) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp, c));
  return a.length === b.length && timingSafeEqual(a, b);
}
