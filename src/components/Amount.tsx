import { inr, inrCompact } from "@/lib/money";

/**
 * A money amount that shortens itself on a phone: ₹1.23 L there, the full
 * ₹1,23,456 from tablet width up. Under a lakh it is just the plain figure.
 */
export default function Amount({ n }: { n: number }) {
  const full = inr(n);
  const short = inrCompact(n);
  if (full === short) return <>{full}</>;
  return (
    <>
      <span className="md:hidden" title={full}>
        {short}
      </span>
      <span className="hidden md:inline">{full}</span>
    </>
  );
}
