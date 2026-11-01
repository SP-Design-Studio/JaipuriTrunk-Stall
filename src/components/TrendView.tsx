"use client";

import { useMemo, useState } from "react";
import { inr } from "@/lib/money";
import type { StallStat } from "@/lib/stallStats";
import { ChartCard, LineTrend, Spark } from "./charts";
import { Delta } from "./figures";

type Kind = "rising" | "steady" | "fading" | "new" | "gone";

const KINDS: Record<Kind, { label: string; tone: string; hint: string }> = {
  rising: {
    label: "Rising",
    tone: "text-gain",
    hint: "Selling faster than at the earlier stalls",
  },
  steady: {
    label: "Steady",
    tone: "text-ink/55",
    hint: "About the usual pace",
  },
  fading: {
    label: "Fading",
    tone: "text-loss",
    hint: "Selling slower than at the earlier stalls",
  },
  new: {
    label: "New",
    tone: "text-gain",
    hint: "First sold at the latest stall",
  },
  gone: {
    label: "Not sold lately",
    tone: "text-loss",
    hint: "Sold before, none at the latest stall",
  },
};

/** How each stall did over time, and which products are speeding up or slowing. */
export default function TrendView({ stats }: { stats: StallStat[] }) {
  const [only, setOnly] = useState<Kind | "all">("all");
  const active = useMemo(() => stats.filter((s) => s.bills > 0), [stats]);
  const shown = active.slice(-10);

  const products = useMemo(() => {
    const recent = active.slice(-8);
    const keys = new Map<string, string>();
    for (const s of recent)
      for (const [k, v] of s.pieceMap) keys.set(k, v.name);
    return [...keys.entries()]
      .map(([key, name]) => {
        // Pieces per selling day at each stall, so a long stall is not favoured.
        const values = recent.map((s) =>
          s.days ? (s.pieceMap.get(key)?.pieces ?? 0) / s.days : 0,
        );
        const latest = values[values.length - 1];
        const before = values.slice(0, -1);
        const avg = before.reduce((n, v) => n + v, 0) / (before.length || 1);
        const kind: Kind =
          avg === 0 && latest > 0
            ? "new"
            : latest === 0
              ? "gone"
              : latest >= avg * 1.15
                ? "rising"
                : latest <= avg * 0.85
                  ? "fading"
                  : "steady";
        return { key, name, values, latest, avg, kind };
      })
      .sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name));
  }, [active]);

  if (active.length < 2)
    return (
      <p className="text-ink/50 mx-auto max-w-md py-12 text-center text-sm">
        A trend needs at least two stalls with bills. Once the next stall has
        sold something, how it compares with this one shows up here.
      </p>
    );

  const last = active[active.length - 1];
  const prev = active[active.length - 2];
  const list = products.filter((p) => only === "all" || p.kind === only);
  const counts = (k: Kind) => products.filter((p) => p.kind === k).length;
  const chip = (on: boolean) =>
    `min-h-11 border px-4 text-sm ${on ? "bg-maroon border-maroon text-cream" : "border-maroon/25 text-maroon hover:bg-petal"}`;
  const th = "px-3 py-2 font-normal";
  const head =
    "text-olive/80 border-maroon/15 border-b text-[11px] tracking-[0.14em] uppercase";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["Takings per day", last.perDay, prev.perDay, inr],
            ["Average bill", last.average, prev.average, inr],
            [
              "Bills per day",
              last.days ? last.bills / last.days : 0,
              prev.days ? prev.bills / prev.days : 0,
              (n: number) => (Math.round(n * 10) / 10).toString(),
            ],
            [
              "Pieces per bill",
              last.bills ? last.pieces / last.bills : 0,
              prev.bills ? prev.pieces / prev.bills : 0,
              (n: number) => (Math.round(n * 10) / 10).toString(),
            ],
          ] as const
        ).map(([t, now, before, fmt]) => (
          <div key={t} className="border-maroon/15 border bg-white/50 p-4">
            <div className="text-olive/80 text-xs tracking-[0.18em] uppercase">
              {t}
            </div>
            <div className="font-display text-maroon num mt-1 truncate text-xl">
              {fmt(now)}
            </div>
            <div className="mt-0.5 text-xs">
              <Delta from={before} to={now} />{" "}
              <span className="text-ink/45">vs {prev.name}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Takings per selling day"
          note="One point per stall, oldest to newest, so a longer stall is not favoured"
        >
          <LineTrend
            label="Takings per selling day"
            points={shown.map((s) => ({ label: s.name, value: s.perDay }))}
          />
        </ChartCard>
        <ChartCard
          title="Average bill"
          note="What a customer spent, stall by stall"
        >
          <LineTrend
            label="Average bill"
            points={shown.map((s) => ({ label: s.name, value: s.average }))}
          />
        </ChartCard>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-maroon text-lg">
            Product by product
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            <button
              onClick={() => setOnly("all")}
              className={chip(only === "all")}
              aria-pressed={only === "all"}
            >
              All
            </button>
            {(["rising", "fading", "new", "gone"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setOnly(k)}
                className={chip(only === k)}
                aria-pressed={only === k}
              >
                {KINDS[k].label} ({counts(k)})
              </button>
            ))}
          </div>
        </div>
        <div className="border-maroon/15 overflow-x-auto border bg-white/50">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-[#fdf9f4]`}>
                  Product
                </th>
                <th className={th}>Pieces per day, stall by stall</th>
                <th className={`${th} text-right`}>Usually</th>
                <th className={`${th} text-right`}>Latest</th>
                <th className={th}>Trend</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {list.map((p) => {
                const k = KINDS[p.kind];
                return (
                  <tr key={p.key}>
                    <td className="sticky left-0 z-10 bg-[#fdf9f4] px-3 py-2.5 font-semibold">
                      {p.name}
                    </td>
                    <td className="px-3 py-2">
                      <Spark
                        values={p.values}
                        tone={
                          p.kind === "rising" || p.kind === "new"
                            ? "up"
                            : p.kind === "fading" || p.kind === "gone"
                              ? "down"
                              : "flat"
                        }
                      />
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {(Math.round(p.avg * 10) / 10).toString()}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {(Math.round(p.latest * 10) / 10).toString()}
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold whitespace-nowrap ${k.tone}`}
                      title={k.hint}
                    >
                      {k.label}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink/50 px-3 py-6 text-center">
                    No products in this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-ink/50 text-xs">
          Compares each product’s pieces per selling day at the latest stall (
          {last.name}) with its average over the earlier ones (up to the last{" "}
          {Math.min(active.length, 8)} stalls). Rising is 15% or more above the
          usual, fading 15% or more below. Stalls differ in size and season, so
          read it as a hint, not a verdict.
        </p>
      </section>
    </div>
  );
}
