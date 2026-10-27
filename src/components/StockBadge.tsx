/** "42 left", "Only 2 left" or "Sold out", coloured so it can be read across a stall. */
export default function StockBadge({ left }: { left: number }) {
  const out = left <= 0;
  const low = !out && left <= 3;
  return (
    <span
      className={`inline-block px-2 py-1 text-sm leading-none font-bold whitespace-nowrap ${
        out
          ? "bg-red-700 text-white"
          : low
            ? "bg-amber-400 text-amber-950"
            : "bg-olive/10 text-olive-deep"
      }`}
    >
      {out ? "Sold out" : low ? `Only ${left} left` : `${left} left`}
    </span>
  );
}
