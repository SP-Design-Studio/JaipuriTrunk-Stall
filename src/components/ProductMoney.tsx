"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import { inr } from "@/lib/money";
import {
  PRICE_BANDS,
  bandOf,
  catalogResolver,
  moneyLines,
  productRows,
  type ProductRow,
} from "@/lib/productMoney";
import type { Sale } from "@/lib/types";

/**
 * What each product earned. Read-only, and follows the Sales filter. Figures are
 * after offers (a bill's offer is spread over its lines in proportion), so the
 * products add up to Takings exactly; the "before offers" column is what the
 * existing "What sold" tab shows.
 */
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

type Sort = "net" | "pieces" | "avg";

export default function ProductMoney({
  sales,
  catalog,
}: {
  sales: Sale[];
  catalog: Catalog | null;
}) {
  const [sort, setSort] = useState<Sort>("net");

  const d = useMemo(() => {
    const lines = moneyLines(sales);
    const resolve = catalogResolver(catalog);
    const rows = productRows(lines, resolve);
    const net = rows.reduce((n, r) => n + r.net, 0);
    const gross = rows.reduce((n, r) => n + r.gross, 0);
    const pieces = rows.reduce((n, r) => n + r.pieces, 0);

    const byCategory = new Map<
      string,
      { pieces: number; net: number; products: number }
    >();
    for (const r of rows) {
      const c = byCategory.get(r.category) ?? {
        pieces: 0,
        net: 0,
        products: 0,
      };
      byCategory.set(r.category, {
        pieces: c.pieces + r.pieces,
        net: c.net + r.net,
        products: c.products + 1,
      });
    }

    const bands = PRICE_BANDS.map((b) => ({
      label: b.label,
      pieces: 0,
      net: 0,
    }));
    for (const x of lines) {
      const i = bandOf(x.line.price);
      bands[i].pieces += x.line.qty;
      bands[i].net += x.net;
    }

    const tally = (pick: (l: Sale["lines"][number]) => string | undefined) => {
      const m = new Map<string, { pieces: number; net: number }>();
      for (const x of lines) {
        const k = pick(x.line);
        if (!k) continue;
        const c = m.get(k) ?? { pieces: 0, net: 0 };
        m.set(k, { pieces: c.pieces + x.line.qty, net: c.net + x.net });
      }
      return [...m.entries()].sort((a, b) => b[1].net - a[1].net).slice(0, 8);
    };

    // Catalogue products with no sales in this list.
    const sold = new Set(rows.map((r) => r.key));
    const neverSold = (catalog?.categories ?? [])
      .flatMap((c) =>
        c.items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          category: c.title,
        })),
      )
      .filter((i) => !sold.has(i.id));

    return {
      rows,
      net,
      gross,
      pieces,
      offers: gross - net,
      categories: [...byCategory.entries()].sort((a, b) => b[1].net - a[1].net),
      bands,
      sizes: tally((l) => l.size),
      colours: tally((l) => l.color),
      neverSold,
    };
  }, [sales, catalog]);

  const sorted = useMemo(() => {
    const by: Record<Sort, (a: ProductRow, b: ProductRow) => number> = {
      net: (a, b) => b.net - a.net,
      pieces: (a, b) => b.pieces - a.pieces || b.net - a.net,
      avg: (a, b) => b.net / b.pieces - a.net / a.pieces,
    };
    return [...d.rows].sort(by[sort]);
  }, [d.rows, sort]);

  if (sales.length === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No bills in this list to analyse.
      </p>
    );

  const th = "px-3 py-2 font-normal";
  const num = "px-3 py-2.5 text-right whitespace-nowrap";
  const head =
    "text-olive/80 border-maroon/15 border-b text-[11px] tracking-[0.14em] uppercase";
  const box = "border-maroon/15 overflow-x-auto border bg-white/50";
  const chip = (on: boolean) =>
    `min-h-11 border px-4 text-sm ${on ? "bg-maroon border-maroon text-cream" : "border-maroon/25 text-maroon hover:bg-petal"}`;
  const top = d.rows.reduce((m, r) => (r.net > m.net ? r : m), d.rows[0]);
  const maxNet = Math.max(...d.rows.map((r) => r.net), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Products sold", String(d.rows.length), `${d.pieces} pieces`],
          [
            "Average per piece",
            inr(Math.round(d.net / Math.max(d.pieces, 1))),
            `${inr(Math.round(d.gross / Math.max(d.pieces, 1)))} before offers`,
          ],
          [
            "Top product",
            top ? top.name : "—",
            top ? `${inr(top.net)} · ${pct(top.net, d.net)}% of takings` : "",
          ],
          [
            "Net of offers",
            inr(d.net),
            `${inr(d.gross)} − ${inr(d.offers)} offers`,
          ],
        ].map(([t, v, sub]) => (
          <div key={t} className="border-maroon/15 border bg-white/50 p-4">
            <div className="text-olive/80 text-xs tracking-[0.18em] uppercase">
              {t}
            </div>
            <div className="font-display text-maroon mt-1 truncate text-xl">
              {v}
            </div>
            {sub && <div className="text-ink/45 mt-0.5 text-xs">{sub}</div>}
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-maroon text-lg">Each product</h3>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Sort products by"
          >
            {(
              [
                ["net", "Most money"],
                ["pieces", "Most pieces"],
                ["avg", "Highest price"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={chip(sort === k)}
                aria-pressed={sort === k}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={box}>
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Pieces</th>
                <th className={`${th} text-right`}>Before offers</th>
                <th className={`${th} text-right`}>Offers</th>
                <th className={`${th} text-right`}>Net</th>
                <th className={`${th} text-right`}>Per piece</th>
                <th className={`${th} w-40`}>Share of takings</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {sorted.map((r) => (
                <tr key={r.key}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-ink/45 text-xs">{r.category}</div>
                  </td>
                  <td className={num}>{r.pieces}</td>
                  <td className={num}>{inr(r.gross)}</td>
                  <td
                    className={`${num} ${r.offer > 0 ? "text-emerald-700" : "text-ink/30"}`}
                  >
                    {r.offer > 0 ? `−${inr(r.offer)}` : "—"}
                  </td>
                  <td className={`${num} text-maroon font-semibold`}>
                    {inr(r.net)}
                  </td>
                  <td className={num}>{inr(Math.round(r.net / r.pieces))}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="bg-maroon/10 h-2 flex-1"
                        aria-hidden="true"
                      >
                        <div
                          className="bg-maroon h-2"
                          style={{ width: `${pct(r.net, maxNet)}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs">
                        {pct(r.net, d.net)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-maroon/30 border-t-2 font-semibold">
              <tr>
                <td className="px-3 py-2.5">All products</td>
                <td className={num}>{d.pieces}</td>
                <td className={num}>{inr(d.gross)}</td>
                <td className={`${num} text-emerald-700`}>
                  {d.offers > 0 ? `−${inr(d.offers)}` : "—"}
                </td>
                <td className={`${num} text-maroon`}>{inr(d.net)}</td>
                <td className={num}>
                  {inr(Math.round(d.net / Math.max(d.pieces, 1)))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-ink/50 text-xs">
          A bill’s offer is spread over its items in proportion to what each
          came to, so “Net” adds up to Takings exactly.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-2">
          <h3 className="font-display text-maroon text-lg">By category</h3>
          <div className={box}>
            <table className="w-full text-left text-sm">
              <thead className={head}>
                <tr>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Pieces</th>
                  <th className={`${th} text-right`}>Net</th>
                  <th className={`${th} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody className="divide-maroon/10 divide-y">
                {d.categories.map(([name, c]) => (
                  <tr key={name}>
                    <td className="px-3 py-2.5">
                      {name}
                      <span className="text-ink/45 text-xs">
                        {" "}
                        · {c.products} item{c.products === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className={num}>{c.pieces}</td>
                    <td className={`${num} text-maroon font-semibold`}>
                      {inr(c.net)}
                    </td>
                    <td className={num}>{pct(c.net, d.net)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-maroon text-lg">By price point</h3>
          <div className={box}>
            <table className="w-full text-left text-sm">
              <thead className={head}>
                <tr>
                  <th className={th}>Price of one piece</th>
                  <th className={`${th} text-right`}>Pieces</th>
                  <th className={`${th} text-right`}>Net</th>
                  <th className={`${th} text-right`}>Share</th>
                </tr>
              </thead>
              <tbody className="divide-maroon/10 divide-y">
                {d.bands.map((b) => (
                  <tr
                    key={b.label}
                    className={b.pieces === 0 ? "text-ink/35" : ""}
                  >
                    <td className="px-3 py-2.5">{b.label}</td>
                    <td className={num}>{b.pieces}</td>
                    <td className={`${num} font-semibold`}>{inr(b.net)}</td>
                    <td className={num}>{pct(b.net, d.net)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(d.sizes.length > 0 || d.colours.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {(
            [
              ["Money by size", d.sizes],
              ["Money by colour", d.colours],
            ] as const
          ).map(([title, list]) => (
            <section key={title} className="space-y-2">
              <h3 className="font-display text-maroon text-lg">{title}</h3>
              <div className={box}>
                {list.length === 0 ? (
                  <p className="text-ink/45 p-3 text-sm">None recorded.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-maroon/10 divide-y">
                      {list.map(([k, v]) => (
                        <tr key={k}>
                          <td className="px-3 py-2.5">{k}</td>
                          <td className={num}>{v.pieces} pc</td>
                          <td className={`${num} text-maroon font-semibold`}>
                            {inr(v.net)}
                          </td>
                          <td className={num}>{pct(v.net, d.net)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="font-display text-maroon text-lg">
          Not sold in this list
        </h3>
        {d.neverSold.length === 0 ? (
          <p className="text-ink/50 text-sm">
            Every product in your list sold at least once here.
          </p>
        ) : (
          <>
            <p className="text-ink/55 text-sm">
              {d.neverSold.length} of your products had no sales in this list:
              stock that hasn’t moved.
            </p>
            <div className="flex flex-wrap gap-2">
              {d.neverSold.map((i) => (
                <span
                  key={i.id}
                  className="border-maroon/20 bg-white/60 border px-3 py-1.5 text-sm"
                >
                  {i.name}
                  <span className="text-ink/45">
                    {" "}
                    · {i.price ? inr(i.price) : "price asked"}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
