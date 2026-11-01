"use client";

import { useMemo } from "react";
import type { Catalog } from "@/lib/catalog";
import { inr } from "@/lib/money";
import {
  MIN_BILLS,
  byKind,
  byProduct,
  overall,
  type Verdict,
} from "@/lib/offerEffect";
import type { Sale } from "@/lib/types";
import { Delta } from "./figures";

const VERDICTS: Record<Verdict, { label: string; tone: string; hint: string }> =
  {
    paid: {
      label: "Paid off",
      tone: "bg-gain/15 text-gain",
      hint: "More money per bill with an offer, even after the discount",
    },
    lifted: {
      label: "More pieces, less money",
      tone: "bg-amber-400/25 text-amber-900",
      hint: "People bought more, but not enough to cover the discount",
    },
    cut: {
      label: "Just cut the price",
      tone: "bg-loss/15 text-loss",
      hint: "No extra pieces, and less money per bill",
    },
    few: {
      label: "Too few bills",
      tone: "bg-ink/10 text-ink/55",
      hint: `Needs at least ${MIN_BILLS} bills with and without an offer`,
    },
  };

const one = (n: number) => (Math.round(n * 10) / 10).toString();

function Chip({ v }: { v: Verdict }) {
  const x = VERDICTS[v];
  return (
    <span
      title={x.hint}
      className={`inline-block px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${x.tone}`}
    >
      {x.label}
    </span>
  );
}

/**
 * Did offers actually help? Bills that had an offer against bills that did not,
 * overall, by kind of offer, and product by product. These are bills as they
 * happened, not an experiment: an offer may be given to people already buying
 * more, so a result is a hint about the pattern.
 */
export default function OffersView({
  sales,
  catalog,
}: {
  sales: Sale[];
  catalog: Catalog | null;
}) {
  const all = useMemo(() => overall(sales), [sales]);
  const kinds = useMemo(() => byKind(sales), [sales]);
  const products = useMemo(() => byProduct(sales, catalog), [sales, catalog]);

  if (sales.length === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No bills in this list to analyse.
      </p>
    );
  if (all.offer.bills === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No offers were given in this list, so there is nothing to compare.
      </p>
    );

  const th = "px-3 py-2 font-normal";
  const num = "num px-3 py-2.5 text-right whitespace-nowrap";
  const head =
    "text-olive/80 border-maroon/15 border-b text-[11px] tracking-[0.14em] uppercase";
  const box = "border-maroon/15 overflow-x-auto border bg-white/50";
  const compare = [
    ["Bills", all.plain.bills, all.offer.bills, String, "up"],
    ["Pieces per bill", all.plain.basket, all.offer.basket, one, "up"],
    [
      "Average bill",
      all.plain.average,
      all.offer.average,
      (n: number) => inr(Math.round(n)),
      "up",
    ],
    [
      "Money per piece",
      all.plain.perPiece,
      all.offer.perPiece,
      (n: number) => inr(Math.round(n)),
      "up",
    ],
  ] as const;

  const sentence = {
    paid: "Bills with an offer brought in more money than bills without, even after the discount, so the offers look like they paid for themselves.",
    lifted:
      "People bought more pieces when there was an offer, but not enough to make up for the discount.",
    cut: "Offers did not lift the number of pieces, and bills with one brought in less. They mostly cut the price.",
    few: `There are not enough bills yet (at least ${MIN_BILLS} with and without an offer) to say.`,
  }[all.verdict];

  return (
    <div className="space-y-5">
      <section className="border-maroon/15 space-y-3 border bg-white/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-maroon text-lg">
            Bills with an offer, against bills without
          </h3>
          <Chip v={all.verdict} />
        </div>
        <p className="text-sm">
          {sentence} You gave away{" "}
          <span className="text-loss font-semibold">−{inr(all.given)}</span>{" "}
          across {all.offer.bills} of {sales.length} bills.
        </p>
        <div className={box}>
          <table className="w-full min-w-[26rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={th} />
                <th className={`${th} text-right`}>No offer</th>
                <th className={`${th} text-right`}>With an offer</th>
                <th className={`${th} text-right`}>Change</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {compare.map(([label, plain, offer, show]) => (
                <tr key={label}>
                  <td className="px-3 py-2.5">{label}</td>
                  <td className={num}>{show(plain)}</td>
                  <td className={`${num} text-maroon font-semibold`}>
                    {show(offer)}
                  </td>
                  <td className={num}>
                    {label === "Bills" ? (
                      <span className="text-ink/30">—</span>
                    ) : (
                      <Delta from={plain} to={offer} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-maroon text-lg">By kind of offer</h3>
        <div className={box}>
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={th}>Offer</th>
                <th className={`${th} text-right`}>Bills</th>
                <th className={`${th} text-right`}>Given away</th>
                <th className={`${th} text-right`}>Off the price</th>
                <th className={`${th} text-right`}>Pieces per bill</th>
                <th className={`${th} text-right`}>Average bill</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {kinds.map((k) => (
                <tr key={k.name}>
                  <td className="px-3 py-2.5 font-semibold">{k.name}</td>
                  <td className={num}>{k.bills}</td>
                  <td className={`${num} text-loss`}>−{inr(k.given)}</td>
                  <td className={num}>{k.pctOff}%</td>
                  <td className={num}>{one(k.basket)}</td>
                  <td className={`${num} text-maroon font-semibold`}>
                    {inr(Math.round(k.average))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-maroon text-lg">Product by product</h3>
        <div className={box}>
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-[#fdf9f4]`}>
                  Product
                </th>
                <th className={`${th} text-right`}>Bills</th>
                <th
                  className={`${th} text-right`}
                  title="Share of this product's bills that had an offer"
                >
                  With offer
                </th>
                <th className={`${th} text-right`}>Given away</th>
                <th
                  className={`${th} text-right`}
                  title="Offer as a share of the price before offers"
                >
                  Off price
                </th>
                <th
                  className={`${th} text-right`}
                  title="This product's pieces per bill: no offer → with an offer"
                >
                  Pieces / bill
                </th>
                <th
                  className={`${th} text-right`}
                  title="This product's money per bill after the offer: no offer → with an offer"
                >
                  Money / bill
                </th>
                <th className={th}>Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {products.map((p) => {
                const ok = p.verdict !== "few";
                const pc = (s: { bills: number; pieces: number }) =>
                  s.bills ? s.pieces / s.bills : 0;
                const mc = (s: { bills: number; money: number }) =>
                  s.bills ? s.money / s.bills : 0;
                return (
                  <tr key={p.key}>
                    <td className="sticky left-0 z-10 bg-[#fdf9f4] px-3 py-2.5 font-semibold">
                      {p.name}
                    </td>
                    <td className={num}>{p.bills}</td>
                    <td className={num}>
                      {p.offerShare}%{" "}
                      <span className="text-ink/40 text-xs">
                        ({p.offerBills})
                      </span>
                    </td>
                    <td
                      className={`${num} ${p.given > 0 ? "text-loss" : "text-ink/30"}`}
                    >
                      {p.given > 0 ? `−${inr(p.given)}` : "—"}
                    </td>
                    <td className={num}>
                      {p.given > 0 ? `${p.pctOff}%` : "—"}
                    </td>
                    <td className={num}>
                      {ok ? (
                        <>
                          {one(pc(p.without))} → {one(pc(p.withOffer))}
                        </>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    <td className={num}>
                      {ok ? (
                        <>
                          {inr(Math.round(mc(p.without)))} →{" "}
                          <span
                            className={
                              mc(p.withOffer) >= mc(p.without)
                                ? "text-gain"
                                : "text-loss"
                            }
                          >
                            {inr(Math.round(mc(p.withOffer)))}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip v={p.verdict} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-ink/50 text-xs">
          For each product this looks only at the bills it was on, and at its
          own pieces and money (after its share of the offer), so the rest of
          the basket does not blur it. “Paid off” means more money per bill with
          an offer than without. The most discounted products are first. These
          are bills as they happened, not a test: an offer may go to people who
          were already buying more, so treat a verdict as a hint. Needs at least{" "}
          {MIN_BILLS} bills with and without an offer.
        </p>
      </section>
    </div>
  );
}
