import { inr } from "@/lib/money";

/**
 * How money is shown, so every table says the same thing the same way:
 *  - plain totals in ink or maroon (set by the caller), never coloured just for being positive
 *  - money going out (an offer) in red with its minus sign, so colour is never the only cue
 *  - a zero as a faint dash, so the amounts that exist stand out
 */
export function Offer({ n }: { n: number }) {
  return n > 0 ? (
    <span className="text-loss">−{inr(n)}</span>
  ) : (
    <span className="text-ink/30">—</span>
  );
}

/** An amount, or a faint dash when it is nothing. */
export function Money({ n }: { n: number }) {
  return n === 0 ? <span className="text-ink/30">—</span> : <>{inr(n)}</>;
}

/**
 * How much a figure moved, from one stall (or group) to another: an arrow and a
 * percent, green when it moved the good way and red when it did not. `better` says
 * which way is good (more takings is good, more offers given is not).
 */
export function Delta({
  from,
  to,
  better = "up",
}: {
  from: number;
  to: number;
  better?: "up" | "down" | "none";
}) {
  if (from === to) return <span className="text-ink/40">no change</span>;
  const tone = (good: boolean) =>
    better === "none" ? "text-ink/60" : good ? "text-gain" : "text-loss";
  if (from === 0) return <span className={tone(better === "up")}>new</span>;
  const p = Math.round(((to - from) / Math.abs(from)) * 100);
  const up = to > from;
  const good = (up ? "up" : "down") === better;
  return (
    <span className={tone(good)}>
      {up ? "▲" : "▼"} {Math.abs(p)}%
    </span>
  );
}
