/**
 * Everything the stall sees is in India time, whatever the device or the
 * Vercel region thinks. "Today's sales" has to mean today in Hyderabad.
 */
const ZONE = "Asia/Kolkata";

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      hourCycle: "h23",
      ...opts,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/**
 * JT-24102026-203015-0007: date, time, then the running count of bills.
 * The count is handed out by the server, one higher than the last bill, so the
 * numbers go 0001, 0002, 0003… with no gaps and no repeats. After 9999 it simply
 * grows a digit.
 */
export function invoiceNoFor(d: Date, seq: number): string {
  const p = parts(d, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `JT-${p.day}${p.month}${p.year}-${p.hour}${p.minute}${p.second}-${String(seq).padStart(4, "0")}`;
}

/** The count in a bill number, or 0 for none (or for a number from before counting). */
export function seqOf(invoiceNo: string | undefined): number {
  const m = /^JT-\d{8}-\d{6}-(\d{4,})$/.exec(invoiceNo ?? "");
  return m ? Number(m[1]) : 0;
}

/**
 * A stall's days for display: "25 Oct 2026", "25–26 Oct 2026" or
 * "30 Oct – 2 Nov 2026". Takes YYYY-MM-DD and reads them as plain dates, so the
 * device's time zone cannot move a day.
 */
export function prettyRange(from?: string, to?: string): string {
  if (!from) return "";
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const end = to ?? from;
  if (end === from)
    return fmt(from, { day: "numeric", month: "short", year: "numeric" });
  const sameMonth = from.slice(0, 7) === end.slice(0, 7);
  const sameYear = from.slice(0, 4) === end.slice(0, 4);
  const a = sameMonth
    ? fmt(from, { day: "numeric" })
    : fmt(
        from,
        sameYear
          ? { day: "numeric", month: "short" }
          : { day: "numeric", month: "short", year: "numeric" },
      );
  const b = fmt(end, { day: "numeric", month: "short", year: "numeric" });
  return sameMonth ? `${a}–${b}` : `${a} – ${b}`;
}

/** 2026-10-24, for grouping and for "is this today". */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

export const todayKey = () => dayKey(new Date());

export function prettyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function prettyTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .toUpperCase();
}
