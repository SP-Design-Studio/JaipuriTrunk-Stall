"use client";

import { useMemo } from "react";
import { inr, shareText } from "@/lib/money";
import type { Review, Sale } from "@/lib/types";

/**
 * Read-only analysis of the bills in the current Sales list (so it follows the
 * Today / All / stall filter). Everything is worked out from what each bill
 * already stores; nothing here writes anything or changes any other screen.
 *
 * "Returning" customers are matched by phone number across ALL bills, so someone
 * who bought last month and again today counts as returning even on Today's view.
 * Bills with no number can't be matched and are left out of the customer figures.
 */
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

function Bar({
  value,
  max,
  tone = "bg-maroon",
}: {
  value: number;
  max: number;
  tone?: string;
}) {
  return (
    <div className="bg-maroon/10 h-2 w-full" aria-hidden="true">
      <div className={`${tone} h-2`} style={{ width: `${pct(value, max)}%` }} />
    </div>
  );
}

function Card({
  title,
  note,
  children,
  wide = false,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`border-maroon/15 space-y-3 border bg-white/50 p-4 ${wide ? "md:col-span-2" : ""}`}
    >
      <div>
        <h3 className="font-display text-maroon text-lg">{title}</h3>
        {note && <p className="text-ink/50 text-xs">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Insights({
  sales,
  allSales,
  reviews,
}: {
  /** The bills in the current list. */
  sales: Sale[];
  /** Every bill, to tell who has bought before. */
  allSales: Sale[];
  reviews: Map<string, Review>;
}) {
  const a = useMemo(() => {
    const n = sales.length;
    const total = sales.reduce((x, s) => x + s.total, 0);
    const gross = sales.reduce((x, s) => x + s.subtotal, 0);

    // How people pay.
    const upi = sales.filter((s) => s.paymentMode === "UPI");
    const cash = sales.filter((s) => s.paymentMode === "Cash");
    const upiTotal = upi.reduce((x, s) => x + s.total, 0);

    // Offers: do they come with bigger bills, and how are they given?
    const withOffer = sales.filter((s) => s.discountAmount > 0);
    const without = sales.filter((s) => s.discountAmount === 0);
    const avg = (list: Sale[]) =>
      list.length
        ? Math.round(list.reduce((x, s) => x + s.total, 0) / list.length)
        : 0;
    const byType = (["pct", "flat", "round10"] as const).map((k) => {
      const list = withOffer.filter((s) => s.discount.kind === k);
      return {
        k,
        label:
          k === "pct"
            ? "Percentage off"
            : k === "flat"
              ? "Flat amount off"
              : "Rounded to ₹10",
        bills: list.length,
        amount: list.reduce((x, s) => x + s.discountAmount, 0),
      };
    });

    // What a basket looks like.
    const itemsIn = (s: Sale) => s.lines.reduce((x, l) => x + l.qty, 0);
    const units = sales.reduce((x, s) => x + itemsIn(s), 0);
    const buckets = [
      { label: "1 item", test: (k: number) => k === 1 },
      { label: "2 to 3 items", test: (k: number) => k >= 2 && k <= 3 },
      { label: "4 to 5 items", test: (k: number) => k >= 4 && k <= 5 },
      { label: "6 or more", test: (k: number) => k >= 6 },
    ].map((b) => ({
      label: b.label,
      bills: sales.filter((s) => b.test(itemsIn(s))).length,
    }));
    const biggest = sales.reduce<Sale | null>(
      (m, s) => (!m || s.total > m.total ? s : m),
      null,
    );

    // Who comes back (matched by phone across every bill).
    const everyone = new Map<string, number>();
    for (const s of allSales)
      if (s.customerPhone)
        everyone.set(s.customerPhone, (everyone.get(s.customerPhone) ?? 0) + 1);
    const people = new Map<
      string,
      { name: string; phone: string; bills: number; total: number }
    >();
    for (const s of sales) {
      if (!s.customerPhone) continue;
      const cur = people.get(s.customerPhone) ?? {
        name: s.customerName,
        phone: s.customerPhone,
        bills: 0,
        total: 0,
      };
      people.set(s.customerPhone, {
        ...cur,
        bills: cur.bills + 1,
        total: cur.total + s.total,
      });
    }
    const customers = [...people.values()];
    const returning = customers.filter((c) => (everyone.get(c.phone) ?? 0) > 1);
    const returningTotal = returning.reduce((x, c) => x + c.total, 0);
    const top = [...customers].sort((x, y) => y.total - x.total).slice(0, 5);

    // Which sizes and colours sell, across every item.
    const tally = (pick: (l: Sale["lines"][number]) => string | undefined) => {
      const m = new Map<string, number>();
      for (const s of sales)
        for (const l of s.lines) {
          const k = pick(l);
          if (k) m.set(k, (m.get(k) ?? 0) + l.qty);
        }
      return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
    };

    // How well we capture contact details and reviews.
    const withPhone = sales.filter((s) => s.customerPhone).length;
    const consent = sales.filter((s) => s.marketingOk).length;
    const reviewed = sales.filter((s) => reviews.has(s.id)).length;

    return {
      n,
      total,
      gross,
      upi,
      cash,
      upiTotal,
      withOffer,
      without,
      avgWith: avg(withOffer),
      avgWithout: avg(without),
      byType,
      units,
      buckets,
      biggest,
      customers,
      returning,
      returningTotal,
      top,
      sizes: tally((l) => l.size),
      colours: tally((l) => l.color),
      withPhone,
      consent,
      reviewed,
    };
  }, [sales, allSales, reviews]);

  if (a.n === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No bills in this list to analyse.
      </p>
    );

  const maxBucket = Math.max(...a.buckets.map((b) => b.bills), 1);
  const row = "num flex items-baseline justify-between gap-3 text-sm";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="How people pay" note="Share of takings by payment method">
        {[
          {
            label: "UPI",
            total: a.upiTotal,
            bills: a.upi.length,
            tone: "bg-maroon",
          },
          {
            label: "Cash",
            total: a.total - a.upiTotal,
            bills: a.cash.length,
            tone: "bg-[#f49b49]",
          },
        ].map((r) => (
          <div key={r.label} className="space-y-1">
            <div className={row}>
              <span className="font-semibold">{r.label}</span>
              <span>
                {inr(r.total)} · {shareText(r.total, a.total)}
                <span className="text-ink/45">
                  {" "}
                  · {r.bills} bill{r.bills === 1 ? "" : "s"}
                </span>
              </span>
            </div>
            <Bar value={r.total} max={a.total} tone={r.tone} />
          </div>
        ))}
      </Card>

      <Card title="Offers" note="Do offers go with bigger bills?">
        <div className={row}>
          <span>Average bill with an offer</span>
          <strong>{a.withOffer.length ? inr(a.avgWith) : "—"}</strong>
        </div>
        <div className={row}>
          <span>Average bill without</span>
          <strong>{a.without.length ? inr(a.avgWithout) : "—"}</strong>
        </div>
        <div className={row}>
          <span>Bills that had an offer</span>
          <strong>
            {a.withOffer.length} of {a.n} ({shareText(a.withOffer.length, a.n)})
          </strong>
        </div>
        <div className="border-maroon/10 space-y-1 border-t pt-2">
          {a.byType.filter((t) => t.bills > 0).length === 0 ? (
            <p className="text-ink/50 text-sm">No offers given in this list.</p>
          ) : (
            a.byType
              .filter((t) => t.bills > 0)
              .map((t) => (
                <div key={t.k} className={row}>
                  <span>{t.label}</span>
                  <span>
                    <span className="text-loss">−{inr(t.amount)}</span>{" "}
                    <span className="text-ink/45">
                      · {t.bills} bill{t.bills === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
              ))
          )}
        </div>
      </Card>

      <Card title="The typical basket">
        <div className={row}>
          <span>Items per bill</span>
          <strong>{(a.units / a.n).toFixed(1)}</strong>
        </div>
        <div className={row}>
          <span>Average bill</span>
          <strong>{inr(Math.round(a.total / a.n))}</strong>
        </div>
        {a.biggest && (
          <div className={row}>
            <span>Biggest bill</span>
            <strong>
              {inr(a.biggest.total)}{" "}
              <span className="text-ink/45 font-normal">
                · {a.biggest.invoiceNo.slice(-4)}
              </span>
            </strong>
          </div>
        )}
        <div className="border-maroon/10 space-y-1.5 border-t pt-2">
          {a.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0">{b.label}</span>
              <div className="flex-1">
                <Bar value={b.bills} max={maxBucket} />
              </div>
              <span className="w-8 shrink-0 text-right">{b.bills}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Who comes back"
        note="Matched by phone number, across all bills"
      >
        {a.customers.length === 0 ? (
          <p className="text-ink/50 text-sm">
            No phone numbers in this list yet.
          </p>
        ) : (
          <>
            <div className={row}>
              <span>Customers with a number</span>
              <strong>{a.customers.length}</strong>
            </div>
            <div className={row}>
              <span>Returning customers</span>
              <strong>
                {a.returning.length} (
                {shareText(a.returning.length, a.customers.length)})
              </strong>
            </div>
            <div className={row}>
              <span>Takings from returning customers</span>
              <strong>
                {inr(a.returningTotal)} (
                {shareText(
                  a.returningTotal,
                  a.customers.reduce((x, c) => x + c.total, 0),
                )}
                )
              </strong>
            </div>
            <div className="border-maroon/10 space-y-1 border-t pt-2">
              <div className="text-olive/80 text-[11px] tracking-[0.14em] uppercase">
                Top customers here
              </div>
              {a.top.map((c) => (
                <div key={c.phone} className={row}>
                  <span className="min-w-0 truncate">
                    {c.name || "Customer"}{" "}
                    <span className="text-ink/45">· {c.phone}</span>
                  </span>
                  <span className="shrink-0">
                    {inr(c.total)}{" "}
                    <span className="text-ink/45">· {c.bills}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card
        title="Sizes and colours"
        note="Pieces sold, across every item that has them"
      >
        {a.sizes.length === 0 && a.colours.length === 0 ? (
          <p className="text-ink/50 text-sm">
            No sizes or colours recorded in this list.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Sizes", a.sizes],
              ["Colours", a.colours],
            ].map(([title, list]) => (
              <div key={title as string} className="space-y-1.5">
                <div className="text-olive/80 text-[11px] tracking-[0.14em] uppercase">
                  {title as string}
                </div>
                {(list as [string, number][]).length === 0 ? (
                  <p className="text-ink/40 text-xs">None</p>
                ) : (
                  (list as [string, number][]).map(([k, v]) => (
                    <div key={k} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                      <Bar value={v} max={(list as [string, number][])[0][1]} />
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Contact and reviews"
        note="How well we are collecting details"
      >
        {[
          ["Bills with a phone number", a.withPhone],
          ["Agreed to be messaged", a.consent],
          ["Bills reviewed", a.reviewed],
        ].map(([label, count]) => (
          <div key={label as string} className="space-y-1">
            <div className={row}>
              <span>{label as string}</span>
              <strong>
                {count as number} of {a.n} ({shareText(count as number, a.n)})
              </strong>
            </div>
            <Bar value={count as number} max={a.n} />
          </div>
        ))}
      </Card>
    </div>
  );
}
