"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import type { Review, StallEntry } from "@/lib/types";
import { itemsToCsv, salesToCsv } from "@/lib/csv";
import { download } from "@/lib/download";
import { itemRows } from "@/lib/report";
import { followUpText, waLink, type Templates } from "@/lib/messages";
import { inr, variantOf } from "@/lib/money";
import {
  dayKey,
  prettyDate,
  prettyRange,
  prettyTime,
  todayKey,
} from "@/lib/time";
import type { Sale } from "@/lib/types";
import ExportBills from "./ExportBills";
import { useToast } from "./Toasts";
import StockBadge from "./StockBadge";
import VerifyBill from "./VerifyBill";

const tab = (on: boolean) =>
  `inline-flex min-h-11 items-center border px-4 text-sm transition-colors ${
    on
      ? "bg-maroon border-maroon text-cream"
      : "border-maroon/25 text-maroon hover:bg-petal"
  }`;

export default function Sales({
  sales,
  templates,
  currentStall,
  stalls,
  catalog,
  stock,
  reviews,
  onOpen,
}: {
  sales: Sale[];
  templates: Templates | null;
  /** The stall bills are being recorded against now, if one has been started. */
  currentStall?: string;
  /** Every stall in the list, so ones with no bills yet are still shown. */
  stalls: StallEntry[];
  /** The item list and stock counts, for the Stock tab. */
  catalog: Catalog | null;
  stock: Record<string, number> | null;
  /** Buyers' reviews; null if they cannot be read. */
  reviews: Review[] | null;
  onOpen: (sale: Sale) => void;
}) {
  const [range, setRange] = useState<"today" | "all">("today");
  const [view, setView] = useState<
    "log" | "sold" | "days" | "stalls" | "stock" | "reviews" | "people"
  >("log");
  const [verifying, setVerifying] = useState(false);
  const [stallFilter, setStallFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const stallNames = useMemo(
    () =>
      [...new Set(sales.map((s) => s.stall?.name).filter(Boolean))] as string[],
    [sales],
  );
  // The dropdown lists every stall that has bills, and the current one even
  // before its first bill, so choosing "This stall" always has an entry.
  const stallOptions = useMemo(
    () => [
      ...new Set([
        ...stalls.map((x) => x.name),
        ...stallNames,
        ...(currentStall ? [currentStall] : []),
      ]),
    ],
    [stalls, stallNames, currentStall],
  );
  const shown = useMemo(
    () =>
      sales.filter(
        (s) =>
          (range === "all" || dayKey(s.createdAt) === todayKey()) &&
          (stallFilter === "all" || s.stall?.name === stallFilter),
      ),
    [sales, range, stallFilter],
  );

  const stats = useMemo(() => {
    const by = (m: string) =>
      shown.filter((s) => s.paymentMode === m).reduce((n, s) => n + s.total, 0);
    const revenue = shown.reduce((n, s) => n + s.total, 0);
    return {
      revenue,
      count: shown.length,
      units: shown.reduce(
        (n, s) => n + s.lines.reduce((m, l) => m + l.qty, 0),
        0,
      ),
      upi: by("UPI"),
      cash: by("Cash"),
      average: shown.length ? Math.round(revenue / shown.length) : 0,
    };
  }, [shown]);

  const sold = useMemo(() => itemRows(shown), [shown]);

  /** One row per phone number that agreed to be messaged, newest purchase first. */
  const people = useMemo(() => {
    const seen = new Map<string, Sale>();
    for (const s of sales) {
      if (s.customerPhone && s.marketingOk && !seen.has(s.customerPhone))
        seen.set(s.customerPhone, s);
    }
    return [...seen.values()];
  }, [sales]);

  /**
   * One row per stall across ALL bills (the Today / All and stall filters don't
   * apply here: this is the side-by-side view), newest stall first.
   */
  const stallRows = useMemo(() => {
    const by = new Map<
      string,
      {
        name: string;
        first: string;
        last: string;
        /** The days the stall was set up to run, when it says. */
        planned?: { from?: string; to?: string };
        days: Set<string>;
        bills: number;
        units: number;
        upi: number;
        cash: number;
        discount: number;
        total: number;
      }
    >();
    for (const s of sales) {
      const name = s.stall?.name ?? "";
      const r = by.get(name) ?? {
        name,
        first: s.createdAt,
        last: s.createdAt,
        planned: s.stall?.from
          ? { from: s.stall.from, to: s.stall.to }
          : undefined,
        days: new Set<string>(),
        bills: 0,
        units: 0,
        upi: 0,
        cash: 0,
        discount: 0,
        total: 0,
      };
      if (s.createdAt < r.first) r.first = s.createdAt;
      if (s.createdAt > r.last) r.last = s.createdAt;
      r.days.add(dayKey(s.createdAt));
      r.bills += 1;
      r.units += s.lines.reduce((n, l) => n + l.qty, 0);
      r.discount += s.discountAmount;
      r.total += s.total;
      if (s.paymentMode === "UPI") r.upi += s.total;
      else r.cash += s.total;
      by.set(name, r);
    }
    // Stalls in the list with no bills yet still get a row (of zeros).
    for (const st of stalls)
      if (!by.has(st.name)) {
        const when = `${st.from ?? "1970-01-01"}T00:00:00.000Z`;
        by.set(st.name, {
          name: st.name,
          first: when,
          last: when,
          planned: st.from ? { from: st.from, to: st.to } : undefined,
          days: new Set<string>(),
          bills: 0,
          units: 0,
          upi: 0,
          cash: 0,
          discount: 0,
          total: 0,
        });
      }
    return [...by.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [sales, stalls]);

  /** Counted items with what is left and what sold in the current list. */
  const stockRows = useMemo(() => {
    if (!catalog || !stock) return [];
    const sold = new Map<string, number>();
    for (const s of shown)
      for (const l of s.lines)
        if (l.itemId) sold.set(l.itemId, (sold.get(l.itemId) ?? 0) + l.qty);
    return catalog.categories
      .flatMap((c) =>
        c.items
          .filter((i) => stock[i.id] !== undefined)
          .map((i) => ({
            id: i.id,
            name: i.name,
            category: c.title,
            left: stock[i.id],
            sold: sold.get(i.id) ?? 0,
          })),
      )
      .sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));
  }, [catalog, stock, shown]);
  const shownReviews = useMemo(
    () =>
      (reviews ?? []).filter(
        (r) =>
          (range === "all" || dayKey(r.createdAt) === todayKey()) &&
          (stallFilter === "all" || r.stallName === stallFilter),
      ),
    [reviews, range, stallFilter],
  );
  const needAttention = stockRows.filter((r) => r.left <= 3).length;

  /** One row per day in the list, newest first, for the books. */
  const days = useMemo(() => {
    const by = new Map<
      string,
      {
        key: string;
        label: string;
        bills: number;
        upi: number;
        cash: number;
        discount: number;
        total: number;
      }
    >();
    for (const s of shown) {
      const key = dayKey(s.createdAt);
      const d = by.get(key) ?? {
        key,
        label: prettyDate(s.createdAt),
        bills: 0,
        upi: 0,
        cash: 0,
        discount: 0,
        total: 0,
      };
      d.bills += 1;
      d.total += s.total;
      d.discount += s.discountAmount;
      if (s.paymentMode === "UPI") d.upi += s.total;
      else d.cash += s.total;
      by.set(key, d);
    }
    return [...by.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [shown]);

  const kpi = (title: string, value: string, sub?: string) => (
    <div className="border-maroon/15 border bg-white/50 p-4">
      <div className="text-olive/80 text-xs tracking-[0.18em] uppercase">
        {title}
      </div>
      <div className="font-display text-maroon mt-1 text-2xl">{value}</div>
      {sub && <div className="text-ink/45 mt-0.5 text-xs">{sub}</div>}
    </div>
  );

  const empty = (text: string) => (
    <p className="text-ink/50 py-12 text-center text-sm">{text}</p>
  );
  const list = "divide-maroon/10 border-maroon/15 divide-y border bg-white/50";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRange("today");
                setStallFilter("all");
              }}
              className={tab(range === "today" && stallFilter === "all")}
            >
              Today
            </button>
            <button
              onClick={() => {
                setRange("all");
                setStallFilter("all");
              }}
              className={tab(range === "all" && stallFilter === "all")}
            >
              All sales
            </button>
            {currentStall && (
              <button
                onClick={() => {
                  setStallFilter(currentStall);
                  setRange("all");
                }}
                className={tab(range === "all" && stallFilter === currentStall)}
              >
                This stall
              </button>
            )}
            {stallOptions.length > 0 && (
              <select
                value={stallFilter}
                onChange={(e) => {
                  setStallFilter(e.target.value);
                  // Looking at a past stall means looking at all of its days.
                  if (e.target.value !== "all") setRange("all");
                }}
                aria-label="Filter by stall"
                className="border-maroon/25 text-maroon min-h-11 border bg-white/70 px-3 text-sm"
              >
                <option value="all">All stalls</option>
                {stallOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setExporting(true)}
              disabled={shown.length === 0}
              className={`${tab(false)} disabled:opacity-40`}
            >
              Print / PDF
            </button>
            <button onClick={() => setVerifying(true)} className={tab(false)}>
              Verify receipt
            </button>
            <button
              onClick={() => {
                download(
                  `JaipuriTrunk-bills-${todayKey()}.csv`,
                  salesToCsv(shown),
                );
                toast.success("CSV downloaded.");
              }}
              disabled={shown.length === 0}
              className={`${tab(false)} disabled:opacity-40`}
            >
              Bills CSV
            </button>
            <button
              onClick={() => {
                download(
                  `JaipuriTrunk-items-sold-${todayKey()}.csv`,
                  itemsToCsv(shown),
                );
                toast.success("CSV downloaded.");
              }}
              disabled={shown.length === 0}
              className={`${tab(false)} disabled:opacity-40`}
            >
              Items CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpi(
            "Takings",
            inr(stats.revenue),
            `${stats.count} ${stats.count === 1 ? "bill" : "bills"}`,
          )}
          {kpi("Items sold", String(stats.units), "pieces handed over")}
          {kpi("UPI", inr(stats.upi))}
          {kpi("Cash", inr(stats.cash), "to be in the box")}
          {kpi("Average bill", inr(stats.average))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView("log")}
            className={tab(view === "log")}
          >
            Bills
          </button>
          <button
            onClick={() => setView("sold")}
            className={tab(view === "sold")}
          >
            What sold
          </button>
          <button
            onClick={() => setView("stock")}
            className={tab(view === "stock")}
          >
            Stock
            {needAttention > 0 && (
              <span className="ml-2 bg-amber-400 px-1.5 text-xs font-semibold text-amber-950">
                {needAttention} low
              </span>
            )}
          </button>
          <button
            onClick={() => setView("reviews")}
            className={tab(view === "reviews")}
          >
            Reviews
            {shownReviews.length > 0 && (
              <span className="text-ink/50 ml-1">({shownReviews.length})</span>
            )}
          </button>
          <button
            onClick={() => setView("stalls")}
            className={tab(view === "stalls")}
          >
            By stall
          </button>
          <button
            onClick={() => setView("days")}
            className={tab(view === "days")}
          >
            By day
          </button>
          <button
            onClick={() => setView("people")}
            className={tab(view === "people")}
          >
            Customers to message ({people.length})
          </button>
        </div>

        {view === "log" &&
          (shown.length === 0 ? (
            stallFilter !== "all" ? (
              <div className="py-12 text-center text-sm">
                <p className="text-ink/60">
                  No bills at “{stallFilter}” yet
                  {range === "today" ? " today" : ""}.
                </p>
                <button
                  onClick={() => {
                    setStallFilter("all");
                    setRange("all");
                  }}
                  className="text-maroon mt-2 min-h-11 px-3 underline"
                >
                  Show bills from every stall
                </button>
              </div>
            ) : (
              empty(
                range === "today"
                  ? "No sales yet today."
                  : "No sales recorded.",
              )
            )
          ) : (
            <ul className={list}>
              {shown.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onOpen(s)}
                    className="hover:bg-petal/60 flex min-h-16 w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left sm:flex-nowrap"
                  >
                    <div className="w-full shrink-0 sm:w-52">
                      <div className="text-sm font-semibold">{s.invoiceNo}</div>
                      <div className="text-ink/45 text-xs">
                        {range === "all" ? `${prettyDate(s.createdAt)}, ` : ""}
                        {prettyTime(s.createdAt)}
                        {s.stall ? ` · ${s.stall.name}` : ""}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {s.customerName || "Walk-in"}
                        {s.customerPhone && (
                          <span className="text-ink/45">
                            {" "}
                            · {s.customerPhone}
                          </span>
                        )}
                      </div>
                      <div className="text-ink/50 truncate text-xs">
                        {s.lines
                          .map(
                            (l) =>
                              `${l.name}${variantOf(l) ? ` (${variantOf(l)})` : ""} ×${l.qty}`,
                          )
                          .join(", ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-maroon text-sm font-semibold">
                        {inr(s.total)}
                      </div>
                      <div className="text-ink/45 text-xs">{s.paymentMode}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {view === "sold" &&
          (sold.length === 0 ? (
            empty(
              range === "today"
                ? "Nothing sold yet today."
                : "Nothing sold yet.",
            )
          ) : (
            <>
              <ul className="space-y-3">
                {sold.map((item) => (
                  <li
                    key={item.name}
                    className="border-maroon/15 border bg-white/50"
                  >
                    <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
                      <div className="font-display text-ink text-lg">
                        {item.name}
                      </div>
                      <div className="text-right">
                        <span className="text-maroon text-lg font-semibold">
                          {item.units}
                        </span>
                        <span className="text-ink/50 text-sm">
                          {" "}
                          sold · {inr(item.revenue)}
                        </span>
                      </div>
                    </div>
                    <table className="mt-2 w-full text-sm">
                      <thead>
                        <tr className="text-olive/70 text-xs tracking-[0.14em] uppercase">
                          <th className="px-4 py-1 text-left font-normal">
                            Size · colour
                          </th>
                          <th className="px-2 py-1 text-right font-normal">
                            Qty
                          </th>
                          <th className="px-2 py-1 text-right font-normal">
                            Price
                          </th>
                          <th className="px-4 py-1 text-right font-normal">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-maroon/10 divide-y">
                        {item.variants.map((v) => (
                          <tr key={`${v.label}|${v.price}`}>
                            <td className="px-4 py-2">
                              {v.label || (
                                <span className="text-ink/40">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold">
                              {v.qty}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {inr(v.price)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {inr(v.price * v.qty)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </li>
                ))}
              </ul>
              <p className="text-ink/45 text-xs">
                Item totals are before any bill discount, so together they can
                run a little above Takings.
              </p>
            </>
          ))}

        {view === "stock" &&
          (stockRows.length === 0 ? (
            empty(
              "No items are being counted yet. Type a stock number next to an item on the Items tab.",
            )
          ) : (
            <>
              <div className="border-maroon/15 overflow-x-auto border bg-white/50">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-olive/80 border-maroon/15 border-b text-xs tracking-[0.14em] uppercase">
                    <tr>
                      <th className="px-4 py-3 font-normal">Item</th>
                      <th className="px-4 py-3 font-normal">Category</th>
                      <th className="px-4 py-3 text-right font-normal">
                        In stock
                      </th>
                      <th className="px-4 py-3 text-right font-normal">
                        Sold (this list)
                      </th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-maroon/10 divide-y">
                    {stockRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-semibold">{r.name}</td>
                        <td className="text-ink/60 px-4 py-3">{r.category}</td>
                        <td className="px-4 py-3 text-right">{r.left}</td>
                        <td className="px-4 py-3 text-right">{r.sold}</td>
                        <td className="px-4 py-3">
                          <StockBadge left={r.left} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-ink/50 text-xs">
                {stockRows.length} counted item
                {stockRows.length === 1 ? "" : "s"}, lowest stock first. “Sold”
                follows the Today / stall filter above and counts bills made
                since stock tracking began. Change a number on the Items tab.
              </p>
            </>
          ))}

        {view === "reviews" &&
          (shownReviews.length === 0 ? (
            empty(
              reviews === null
                ? "Reviews aren’t available yet."
                : "No reviews in this list yet. Customers are asked when they open their bill.",
            )
          ) : (
            <>
              <div className="border-maroon/15 flex flex-wrap items-center gap-x-6 gap-y-1 border bg-white/50 p-4">
                <div>
                  <span className="font-display text-maroon text-3xl">
                    {(
                      shownReviews.reduce((n, r) => n + r.rating, 0) /
                      shownReviews.length
                    ).toFixed(1)}
                  </span>
                  <span className="text-ink/50 text-sm"> / 5</span>
                </div>
                <div className="text-sm">
                  <Stars
                    n={Math.round(
                      shownReviews.reduce((n, r) => n + r.rating, 0) /
                        shownReviews.length,
                    )}
                  />
                  <div className="text-ink/60">
                    {shownReviews.length} review
                    {shownReviews.length === 1 ? "" : "s"} ·{" "}
                    {shownReviews.filter((r) => r.showPublic).length} OK to show
                    publicly
                  </div>
                </div>
              </div>
              <ul className={list}>
                {shownReviews.map((r) => (
                  <li key={r.saleId} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars n={r.rating} />
                      {r.showPublic && (
                        <span className="bg-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          OK to show
                        </span>
                      )}
                    </div>
                    {r.comment && (
                      <p className="text-sm whitespace-pre-wrap">{r.comment}</p>
                    )}
                    <p className="text-ink/50 text-xs">
                      {r.firstName || "Customer"} · {r.invoiceNo}
                      {r.stallName ? ` · ${r.stallName}` : ""} ·{" "}
                      {prettyDate(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ))}

        {view === "stalls" &&
          (stallRows.length === 0 ? (
            empty("No bills yet.")
          ) : (
            <>
              <div className="border-maroon/15 overflow-x-auto border bg-white/50">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="text-olive/80 border-maroon/15 border-b text-xs tracking-[0.14em] uppercase">
                    <tr>
                      <th className="px-4 py-3 font-normal">Stall</th>
                      <th className="px-4 py-3 font-normal">Dates</th>
                      <th className="px-4 py-3 text-right font-normal">
                        Bills
                      </th>
                      <th className="px-4 py-3 text-right font-normal">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right font-normal">UPI</th>
                      <th className="px-4 py-3 text-right font-normal">Cash</th>
                      <th className="px-4 py-3 text-right font-normal">
                        Discounts
                      </th>
                      <th className="px-4 py-3 text-right font-normal">
                        Takings
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-maroon/10 divide-y">
                    {stallRows.map((r) => (
                      <tr
                        key={r.name || "none"}
                        onClick={() => {
                          // Open that stall's own bills.
                          setStallFilter(r.name || "all");
                          setRange("all");
                          setView("log");
                        }}
                        className="hover:bg-petal/60 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold">
                            {r.name || "No stall"}
                          </span>
                          {r.name && r.name === currentStall && (
                            <span className="ml-2 bg-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="text-ink/70 px-4 py-3">
                          {r.planned?.from
                            ? prettyRange(r.planned.from, r.planned.to)
                            : `${prettyDate(r.first)}${
                                dayKey(r.first) !== dayKey(r.last)
                                  ? ` – ${prettyDate(r.last)}`
                                  : ""
                              }`}
                          <span className="text-ink/45 block text-xs">
                            {r.bills === 0
                              ? "no bills yet"
                              : `${r.days.size} day${r.days.size === 1 ? "" : "s"}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{r.bills}</td>
                        <td className="px-4 py-3 text-right">{r.units}</td>
                        <td className="px-4 py-3 text-right">{inr(r.upi)}</td>
                        <td className="px-4 py-3 text-right">{inr(r.cash)}</td>
                        <td className="px-4 py-3 text-right">
                          {inr(r.discount)}
                        </td>
                        <td className="text-maroon px-4 py-3 text-right font-semibold">
                          {inr(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-maroon/30 border-t-2 font-semibold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>
                        All stalls
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stallRows.reduce((n, r) => n + r.bills, 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stallRows.reduce((n, r) => n + r.units, 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inr(stallRows.reduce((n, r) => n + r.upi, 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inr(stallRows.reduce((n, r) => n + r.cash, 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inr(stallRows.reduce((n, r) => n + r.discount, 0))}
                      </td>
                      <td className="text-maroon px-4 py-3 text-right">
                        {inr(stallRows.reduce((n, r) => n + r.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-ink/50 text-xs">
                Every bill, whatever the Today / All filter says. Tap a stall to
                open its bills. Item counts are pieces sold.
              </p>
            </>
          ))}

        {view === "days" &&
          (days.length === 0 ? (
            empty("No bills in this list.")
          ) : (
            <div className="border-maroon/15 overflow-x-auto border bg-white/50">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-olive/80 border-maroon/15 border-b text-xs tracking-[0.14em] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-normal">Day</th>
                    <th className="px-4 py-3 text-right font-normal">Bills</th>
                    <th className="px-4 py-3 text-right font-normal">UPI</th>
                    <th className="px-4 py-3 text-right font-normal">Cash</th>
                    <th className="px-4 py-3 text-right font-normal">
                      Discounts
                    </th>
                    <th className="px-4 py-3 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-maroon/10 divide-y">
                  {days.map((d) => (
                    <tr key={d.key}>
                      <td className="px-4 py-3">{d.label}</td>
                      <td className="px-4 py-3 text-right">{d.bills}</td>
                      <td className="px-4 py-3 text-right">{inr(d.upi)}</td>
                      <td className="px-4 py-3 text-right">{inr(d.cash)}</td>
                      <td className="px-4 py-3 text-right">
                        {inr(d.discount)}
                      </td>
                      <td className="text-maroon px-4 py-3 text-right font-semibold">
                        {inr(d.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-maroon/30 border-t-2 font-semibold">
                  <tr>
                    <td className="px-4 py-3">All days</td>
                    <td className="px-4 py-3 text-right">{stats.count}</td>
                    <td className="px-4 py-3 text-right">{inr(stats.upi)}</td>
                    <td className="px-4 py-3 text-right">{inr(stats.cash)}</td>
                    <td className="px-4 py-3 text-right">
                      {inr(days.reduce((n, d) => n + d.discount, 0))}
                    </td>
                    <td className="text-maroon px-4 py-3 text-right">
                      {inr(stats.revenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

        {view === "people" &&
          (people.length === 0 ? (
            empty(
              "Nobody yet. A customer appears here when you take their number and tick “happy to hear about our launch”.",
            )
          ) : (
            <ul className={list}>
              {people.map((p) => (
                <li
                  key={p.customerPhone}
                  className="flex min-h-16 items-center gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{p.customerName || "No name"}</div>
                    <div className="text-ink/50 text-xs">
                      {p.customerPhone} · last bought {prettyDate(p.createdAt)}
                    </div>
                  </div>
                  <a
                    href={waLink(
                      p.customerPhone,
                      followUpText(p.customerName, templates),
                    )}
                    className="border-olive/40 text-olive hover:bg-olive/10 inline-flex min-h-11 items-center border px-4 text-sm"
                  >
                    WhatsApp
                  </a>
                </li>
              ))}
            </ul>
          ))}
      </div>
      {verifying && <VerifyBill onClose={() => setVerifying(false)} />}
      {exporting && (
        <ExportBills
          sales={shown}
          label={
            stallFilter !== "all"
              ? stallFilter
              : range === "today"
                ? "Today"
                : "All sales"
          }
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

/** Filled stars out of five, for a review's rating. */
function Stars({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} out of 5 stars`}
      className="tracking-wider text-[#f49b49]"
    >
      {"★".repeat(n)}
      <span className="text-ink/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}
