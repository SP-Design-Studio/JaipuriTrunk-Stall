"use client";

import { useMemo, useState } from "react";
import { itemsToCsv, salesToCsv } from "@/lib/csv";
import { itemRows } from "@/lib/report";
import { followUpText, waLink, type Templates } from "@/lib/messages";
import { inr, variantOf } from "@/lib/money";
import { dayKey, prettyDate, prettyTime, todayKey } from "@/lib/time";
import type { Sale } from "@/lib/types";
import ExportBills from "./ExportBills";
import VerifyBill from "./VerifyBill";

const tab = (on: boolean) =>
  `inline-flex min-h-11 items-center border px-4 text-sm transition-colors ${
    on
      ? "bg-maroon border-maroon text-cream"
      : "border-maroon/25 text-maroon hover:bg-petal"
  }`;

function download(name: string, text: string) {
  // The BOM makes Excel read the file as UTF-8, so ₹ and names survive.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function Sales({
  sales,
  templates,
  onOpen,
}: {
  sales: Sale[];
  templates: Templates | null;
  onOpen: (sale: Sale) => void;
}) {
  const [range, setRange] = useState<"today" | "all">("today");
  const [view, setView] = useState<"log" | "sold" | "people">("log");
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const shown = useMemo(
    () =>
      range === "all"
        ? sales
        : sales.filter((s) => dayKey(s.createdAt) === todayKey()),
    [sales, range],
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
              onClick={() => setRange("today")}
              className={tab(range === "today")}
            >
              Today
            </button>
            <button
              onClick={() => setRange("all")}
              className={tab(range === "all")}
            >
              All sales
            </button>
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
              onClick={() =>
                download(
                  `JaipuriTrunk-bills-${todayKey()}.csv`,
                  salesToCsv(shown),
                )
              }
              disabled={shown.length === 0}
              className={`${tab(false)} disabled:opacity-40`}
            >
              Bills CSV
            </button>
            <button
              onClick={() =>
                download(
                  `JaipuriTrunk-items-sold-${todayKey()}.csv`,
                  itemsToCsv(shown),
                )
              }
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
            onClick={() => setView("people")}
            className={tab(view === "people")}
          >
            Customers to message ({people.length})
          </button>
        </div>

        {view === "log" &&
          (shown.length === 0 ? (
            empty(
              range === "today" ? "No sales yet today." : "No sales recorded.",
            )
          ) : (
            <ul className={list}>
              {shown.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onOpen(s)}
                    className="hover:bg-petal/60 flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left"
                  >
                    <div className="w-32 shrink-0">
                      <div className="text-sm font-semibold">{s.invoiceNo}</div>
                      <div className="text-ink/45 text-xs">
                        {range === "all" ? `${prettyDate(s.createdAt)}, ` : ""}
                        {prettyTime(s.createdAt)}
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
          label={range === "today" ? "Today" : "All sales"}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}
