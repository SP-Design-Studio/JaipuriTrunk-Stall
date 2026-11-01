"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import { rowsToCsv } from "@/lib/csv";
import { download } from "@/lib/download";
import { inr, shareText } from "@/lib/money";
import { costPrices, productProfits } from "@/lib/profit";
import {
  PRICE_BANDS,
  abcClasses,
  bandOf,
  catalogResolver,
  listPrices,
  moneyLines,
  productRows,
  type ProductRow,
} from "@/lib/productMoney";
import { dayKey, todayKey } from "@/lib/time";
import type { Sale } from "@/lib/types";
import {
  CategoryDonut,
  ChartCard,
  DailyChart,
  OffersChart,
  ParetoChart,
  PriceVolumeChart,
} from "./charts";
import { useToast } from "./Toasts";

/**
 * What each product earned. Read-only, and follows the Sales filter. Figures are
 * after offers (a bill's offer is spread over its lines in proportion), so the
 * products add up to Takings exactly; the "before offers" column is what the
 * existing "What sold" tab shows.
 */
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

type Sort = "net" | "pieces" | "avg" | "profit";

export default function ProductMoney({
  sales,
  catalog,
  label,
}: {
  sales: Sale[];
  catalog: Catalog | null;
  /** What the list is (a stall name, "today", "all"), for the CSV file name. */
  label: string;
}) {
  const toast = useToast();
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

    // Price realised: what was actually collected per piece, as a share of the
    // product's list price (today's list price; a product with none fixed is
    // measured against the price it was rung up at).
    const lists = listPrices(catalog);
    const classes = abcClasses(rows);
    const detail = new Map(
      rows.map((r) => {
        const list = lists.get(r.key) ?? Math.round(r.gross / r.pieces);
        const realised = Math.round((r.net / (r.pieces * list)) * 100);
        return [
          r.key,
          { list, realised, klass: classes.get(r.key) ?? "C" },
        ] as const;
      }),
    );
    // Profit, for the products that have a cost price (set on the Items screen).
    const profits = productProfits(rows, costPrices(catalog));
    const costed = rows.filter((r) => profits.has(r.key));
    const costedNet = costed.reduce((n, r) => n + r.net, 0);
    const totalProfit = costed.reduce(
      (n, r) => n + (profits.get(r.key)?.profit ?? 0),
      0,
    );
    const totalCost = costed.reduce(
      (n, r) => n + (profits.get(r.key)?.cost ?? 0),
      0,
    );
    const ranked = [...rows].sort((a, b) => b.net - a.net);
    const top3 = ranked.slice(0, 3).reduce((n, r) => n + r.net, 0);
    const aRows = rows.filter((r) => classes.get(r.key) === "A");
    const aCount = aRows.length;
    const aNet = aRows.reduce((n, r) => n + r.net, 0);

    // Takings per day, split by category, for the daily chart.
    const perDay = new Map<string, Map<string, number>>();
    for (const x of lines) {
      const day = dayKey(x.sale.createdAt);
      const cat = resolve(x.line).category;
      const m = perDay.get(day) ?? new Map<string, number>();
      m.set(cat, (m.get(cat) ?? 0) + x.net);
      perDay.set(day, m);
    }
    const shortDay = (day: string) =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
      }).format(new Date(`${day}T00:00:00Z`));
    const daily = [...perDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, segs]) => ({ day, label: shortDay(day), segs }));
    const chartProducts = rows.map((r) => ({
      key: r.key,
      name: r.name,
      net: r.net,
      gross: r.gross,
      offer: r.offer,
      pieces: r.pieces,
      klass: (classes.get(r.key) ?? "C") as "A" | "B" | "C",
    }));

    return {
      rows,
      detail,
      profits,
      costedCount: costed.length,
      costedNet,
      totalProfit,
      totalCost,
      daily,
      chartProducts,
      top3,
      aCount,
      aNet,
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
    const profit = (r: ProductRow) =>
      d.profits.get(r.key)?.profit ?? Number.NEGATIVE_INFINITY;
    const by: Record<Sort, (a: ProductRow, b: ProductRow) => number> = {
      net: (a, b) => b.net - a.net,
      profit: (a, b) => profit(b) - profit(a) || b.net - a.net,
      pieces: (a, b) => b.pieces - a.pieces || b.net - a.net,
      avg: (a, b) => b.net / b.pieces - a.net / a.pieces,
    };
    return [...d.rows].sort(by[sort]);
  }, [d.rows, d.profits, sort]);

  if (sales.length === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No bills in this list to analyse.
      </p>
    );

  const hasProfit = d.profits.size > 0;
  const th = "px-3 py-2 font-normal";
  // The product column stays put when a wide table scrolls sideways on a phone.
  const stick = "sticky left-0 z-10 bg-[#fdf9f4]";
  const num = "num px-3 py-2.5 text-right whitespace-nowrap";
  const head =
    "text-olive/80 border-maroon/15 border-b text-[11px] tracking-[0.14em] uppercase";
  const box = "border-maroon/15 overflow-x-auto border bg-white/50";
  const chip = (on: boolean) =>
    `min-h-11 border px-4 text-sm ${on ? "bg-maroon border-maroon text-cream" : "border-maroon/25 text-maroon hover:bg-petal"}`;
  function exportCsv() {
    const rows = [...d.rows].sort((a, b) => b.net - a.net);
    const csv = rowsToCsv([
      [
        "Product",
        "Category",
        "Class",
        "Pieces",
        "Before offers",
        "Offers",
        "Net",
        "Per piece",
        "List price",
        "Price realised %",
        "Share of takings %",
        "Cost per piece",
        "Profit",
        "Margin %",
      ],
      ...rows.map((r) => {
        const x = d.detail.get(r.key);
        return [
          r.name,
          r.category,
          x?.klass ?? "",
          r.pieces,
          r.gross,
          r.offer,
          r.net,
          Math.round(r.net / r.pieces),
          x?.list ?? "",
          x?.realised ?? "",
          d.net ? Math.round((r.net / d.net) * 1000) / 10 : 0,
          d.profits.get(r.key)?.unit ?? "",
          d.profits.get(r.key)?.profit ?? "",
          d.profits.get(r.key)?.margin ?? "",
        ];
      }),
    ]);
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    download(`JaipuriTrunk-products-${slug}-${todayKey()}.csv`, csv);
    toast.success("Products CSV downloaded.");
  }

  const top = d.rows.reduce((m, r) => (r.net > m.net ? r : m), d.rows[0]);
  const maxNet = Math.max(...d.rows.map((r) => r.net), 1);

  return (
    <div className="space-y-5">
      <div
        className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${hasProfit ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
      >
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
            top
              ? `${inr(top.net)} · ${shareText(top.net, d.net)} of takings`
              : "",
          ],
          [
            "Net of offers",
            inr(d.net),
            `${inr(d.gross)} − ${inr(d.offers)} offers`,
          ],
          [
            "Concentration",
            `Top 3 = ${shareText(d.top3, d.net)}`,
            `${d.aCount} product${d.aCount === 1 ? "" : "s"} bring ${shareText(d.aNet, d.net)} of takings`,
          ],
          ...(hasProfit
            ? [
                [
                  "Profit on goods",
                  `${d.totalProfit < 0 ? "−" : ""}${inr(Math.abs(d.totalProfit))}`,
                  `${shareText(d.totalProfit, d.costedNet)} margin · cost known for ${d.costedCount} of ${d.rows.length} products`,
                  d.totalProfit < 0 ? "text-loss" : "text-gain",
                ],
              ]
            : []),
        ].map(([t, v, sub, tone]) => (
          <div key={t} className="border-maroon/15 border bg-white/50 p-4">
            <div className="text-olive/80 text-xs tracking-[0.18em] uppercase">
              {t}
            </div>
            <div
              className={`font-display mt-1 truncate text-xl ${tone ?? "text-maroon"}`}
            >
              {v}
            </div>
            {sub && <div className="text-ink/45 mt-0.5 text-xs">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Where your takings come from"
          note="Biggest products first, with the running total. Dark = A products, lighter = B, grey = C."
          wide
        >
          <ParetoChart products={d.chartProducts} total={d.net} />
        </ChartCard>
        <ChartCard
          title="Money given away"
          note="Each product's takings before offers: kept, and given away"
        >
          <OffersChart products={d.chartProducts} />
        </ChartCard>
        <ChartCard title="Share by category">
          <CategoryDonut
            categories={d.categories.map(([name, c]) => ({ name, net: c.net }))}
            total={d.net}
          />
        </ChartCard>
        <ChartCard
          title="Price and volume"
          note="Which products are cheap and popular, and which are pricey and slow"
          wide
        >
          <PriceVolumeChart products={d.chartProducts} />
        </ChartCard>
        <ChartCard
          title="Takings by day"
          note="Each day's net takings, split by category"
          wide
        >
          <DailyChart
            days={d.daily}
            categories={d.categories.map(([name]) => name)}
          />
        </ChartCard>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-maroon text-lg">Each product</h3>
          <div className="flex flex-wrap gap-2">
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
                  ...(hasProfit ? [["profit", "Most profit"] as const] : []),
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
            <button onClick={exportCsv} className={chip(false)}>
              Products CSV
            </button>
          </div>
        </div>
        <div className={box}>
          <table
            className={`w-full text-left text-sm ${hasProfit ? "min-w-[66rem]" : "min-w-[52rem]"}`}
          >
            <thead className={head}>
              <tr>
                <th className={`${th} ${stick}`}>Product</th>
                <th className={`${th} text-right`}>Pieces</th>
                <th className={`${th} text-right`}>Before offers</th>
                <th className={`${th} text-right`}>Offers</th>
                <th className={`${th} text-right`}>Net</th>
                <th className={`${th} text-right`}>Per piece</th>
                <th
                  className={`${th} text-right`}
                  title="What was collected per piece, as a share of the list price"
                >
                  Price realised
                </th>
                {hasProfit && (
                  <>
                    <th
                      className={`${th} text-right`}
                      title="What the pieces sold cost you (cost price × pieces)"
                    >
                      Cost
                    </th>
                    <th
                      className={`${th} text-right`}
                      title="Net takings minus cost"
                    >
                      Profit
                    </th>
                    <th
                      className={`${th} text-right`}
                      title="Profit as a share of net takings"
                    >
                      Margin
                    </th>
                  </>
                )}
                <th className={`${th} w-40`}>Share of takings</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {sorted.map((r, i) => {
                const x = d.detail.get(r.key);
                const tint = i === 0 ? "bg-[#faeee3]" : "";
                return (
                  <tr key={r.key} className={tint}>
                    <td
                      className={`px-3 py-2.5 ${stick} ${i === 0 ? "bg-[#faeee3]" : ""}`}
                    >
                      <div className="font-semibold">
                        {r.name}
                        {x && (
                          <span
                            title={`Class ${x.klass}: ${x.klass === "A" ? "among the products that bring the first 80% of takings" : x.klass === "B" ? "the next 15%" : "the tail"}`}
                            className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold ${x.klass === "A" ? "bg-maroon text-cream" : x.klass === "B" ? "bg-maroon/15 text-maroon" : "bg-ink/10 text-ink/55"}`}
                          >
                            {x.klass}
                          </span>
                        )}
                      </div>
                      <div className="text-ink/45 text-xs">{r.category}</div>
                    </td>
                    <td className={num}>{r.pieces}</td>
                    <td className={`${num} text-ink/60`}>{inr(r.gross)}</td>
                    <td
                      className={`${num} ${r.offer > 0 ? "text-loss" : "text-ink/30"}`}
                    >
                      {r.offer > 0 ? `−${inr(r.offer)}` : "—"}
                    </td>
                    <td className={`${num} text-maroon font-semibold`}>
                      {inr(r.net)}
                    </td>
                    <td className={num}>{inr(Math.round(r.net / r.pieces))}</td>
                    <td
                      className={`${num} ${x && x.realised < 100 ? "text-loss" : x && x.realised > 100 ? "text-gain" : "text-ink/45"}`}
                      title={
                        x
                          ? `${x.realised}% of the list price of ${inr(x.list)} (${x.realised < 100 ? `${100 - x.realised}% given away` : x.realised > 100 ? "above list" : "full price"})`
                          : undefined
                      }
                    >
                      {x ? `${x.realised}%` : "—"}
                    </td>
                    {hasProfit &&
                      (() => {
                        const pr = d.profits.get(r.key);
                        const tone = !pr
                          ? "text-ink/30"
                          : pr.profit < 0
                            ? "text-loss"
                            : "text-gain";
                        return (
                          <>
                            <td className={`${num} text-ink/60`}>
                              {pr ? inr(pr.cost) : "—"}
                            </td>
                            <td className={`${num} font-semibold ${tone}`}>
                              {pr
                                ? `${pr.profit < 0 ? "−" : ""}${inr(Math.abs(pr.profit))}`
                                : "—"}
                            </td>
                            <td className={`${num} ${tone}`}>
                              {pr ? `${pr.margin}%` : "—"}
                            </td>
                          </>
                        );
                      })()}
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
                        <span className="num w-9 text-right text-xs">
                          {shareText(r.net, d.net)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-maroon/30 border-t-2 font-semibold">
              <tr>
                <td className={`px-3 py-2.5 ${stick}`}>All products</td>
                <td className={num}>{d.pieces}</td>
                <td className={`${num} text-ink/60`}>{inr(d.gross)}</td>
                <td
                  className={`${num} ${d.offers > 0 ? "text-loss" : "text-ink/30"}`}
                >
                  {d.offers > 0 ? `−${inr(d.offers)}` : "—"}
                </td>
                <td className={`${num} text-maroon`}>{inr(d.net)}</td>
                <td className={num}>
                  {inr(Math.round(d.net / Math.max(d.pieces, 1)))}
                </td>
                <td
                  className={`${num} ${d.gross > 0 && d.net < d.gross ? "text-loss" : "text-ink/45"}`}
                >
                  {d.gross ? `${Math.round((d.net / d.gross) * 100)}%` : "—"}
                </td>
                {hasProfit && (
                  <>
                    <td className={`${num} text-ink/60`}>{inr(d.totalCost)}</td>
                    <td
                      className={`${num} ${d.totalProfit < 0 ? "text-loss" : "text-gain"}`}
                    >
                      {d.totalProfit < 0 ? "−" : ""}
                      {inr(Math.abs(d.totalProfit))}
                    </td>
                    <td
                      className={`${num} ${d.totalProfit < 0 ? "text-loss" : "text-gain"}`}
                    >
                      {d.costedNet
                        ? `${Math.round((d.totalProfit / d.costedNet) * 100)}%`
                        : "—"}
                    </td>
                  </>
                )}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-ink/50 text-xs">
          A bill’s offer is spread over its items in proportion to what each
          came to, so “Net” adds up to Takings exactly.{" "}
          <strong>Price realised</strong> is the price actually collected per
          piece as a share of the list price (today’s list price; for a product
          with none fixed, the price it was rung up at); red means money given
          away. <strong>A / B / C</strong>: A products bring the first 80% of
          takings, B the next 15%, C the tail.
          {hasProfit && (
            <>
              {" "}
              <strong>Profit</strong> is net takings minus the cost price of the
              pieces sold, so an offer comes straight off it. It uses today’s
              cost price for every bill, and only counts products that have a
              cost set on the Items screen
              {d.costedCount < d.rows.length
                ? ` (${d.rows.length - d.costedCount} here have none, shown as —)`
                : ""}
              .
            </>
          )}
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
                    <td className={num}>{shareText(c.net, d.net)}</td>
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
                    <td className={num}>{shareText(b.net, d.net)}</td>
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
                          <td className={num}>{shareText(v.net, d.net)}</td>
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
