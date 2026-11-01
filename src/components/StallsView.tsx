"use client";

import { useState } from "react";
import { inr, shareText } from "@/lib/money";
import type { StallStat } from "@/lib/stallStats";
import { prettyRange } from "@/lib/time";
import { StallMoneyChart, ChartCard } from "./charts";
import { Delta } from "./figures";

const signed = (n: number) => `${n < 0 ? "−" : ""}${inr(Math.abs(n))}`;

/** True if this stall has any cost figure at all, so a profit means something. */
const hasProfit = (s: StallStat) => s.anyGoodsCost || s.stallCosts > 0;

/** Money-after-costs for a stall, or null when no cost is known. */
const profitOf = (s: StallStat) => (hasProfit(s) ? s.profit : null);

function ProfitCell({ s }: { s: StallStat }) {
  if (!hasProfit(s)) return <span className="text-ink/30">—</span>;
  const partial = s.unknownPieces > 0;
  return (
    <span
      className={`font-semibold ${s.profit < 0 ? "text-loss" : "text-gain"}`}
      title={
        partial
          ? `Leaves out the cost of ${s.unknownPieces} piece${s.unknownPieces === 1 ? "" : "s"} with no cost price, so the real profit is lower.`
          : undefined
      }
    >
      {signed(s.profit)}
      {partial && <span className="text-ink/45 font-normal"> *</span>}
    </span>
  );
}

function BreakEven({ s }: { s: StallStat }) {
  if (s.stallCosts === 0) return <span className="text-ink/30">—</span>;
  if (s.gap <= 0)
    return <span className="text-gain">Covered, {inr(-s.gap)} to spare</span>;
  return (
    <span className="text-loss">
      {inr(s.gap)} short
      {s.breakEvenTakings !== null && (
        <span className="text-ink/45 block text-xs">
          breaks even at {inr(s.breakEvenTakings)}
        </span>
      )}
    </span>
  );
}

/**
 * Every stall side by side: what it took, what it cost, what was left. Looks at all
 * bills (not the Today / stall filter), since comparing stalls is the whole point.
 */
export default function StallsView({
  stats,
  looseBills,
}: {
  stats: StallStat[];
  /** Bills with no stall, left out of this view. */
  looseBills: number;
}) {
  const [pick, setPick] = useState<{ a: string; b: string } | null>(null);
  const withBills = stats.filter((s) => s.bills > 0);
  const newest = [...stats].reverse();
  // By default compare the latest stall with the one before it.
  const a = pick?.a ?? withBills[withBills.length - 2]?.name ?? "";
  const b = pick?.b ?? withBills[withBills.length - 1]?.name ?? "";
  const sa = stats.find((s) => s.name === a);
  const sb = stats.find((s) => s.name === b);

  if (stats.length === 0)
    return (
      <p className="text-ink/50 py-12 text-center text-sm">
        No stalls with bills yet. Bills made while a stall is current are
        counted here.
      </p>
    );

  const th = "px-3 py-2 font-normal";
  const num = "num px-3 py-2.5 text-right whitespace-nowrap";
  const head =
    "text-olive/80 border-maroon/15 border-b text-[11px] tracking-[0.14em] uppercase";
  const select =
    "border-maroon/25 text-maroon min-h-11 min-w-0 flex-1 border bg-white/70 px-3 text-sm";

  const rows: {
    label: string;
    get: (s: StallStat) => number | null;
    show: (n: number) => string;
    better?: "up" | "down" | "none";
  }[] = [
    { label: "Takings", get: (s) => s.takings, show: inr },
    { label: "Bills", get: (s) => s.bills, show: String },
    {
      label: "Selling days",
      get: (s) => s.days,
      show: String,
      better: "none",
    },
    { label: "Takings per day", get: (s) => s.perDay, show: inr },
    { label: "Average bill", get: (s) => s.average, show: inr },
    { label: "Pieces sold", get: (s) => s.pieces, show: String },
    {
      label: "Offers given",
      get: (s) => s.offers,
      show: inr,
      better: "down",
    },
    {
      label: "Costs (stall)",
      get: (s) => (s.stallCosts ? s.stallCosts : null),
      show: inr,
      better: "down",
    },
    { label: "Profit", get: profitOf, show: signed },
  ];

  return (
    <div className="space-y-5">
      <ChartCard
        title="Takings and costs by stall"
        note="Oldest at the top. The figure on the right is what was left after costs."
        wide
      >
        <StallMoneyChart
          stalls={stats.map((s) => ({
            name: s.name,
            takings: s.takings,
            costs: s.goods + s.stallCosts,
            profit: profitOf(s),
          }))}
        />
      </ChartCard>

      <section className="space-y-2">
        <h3 className="font-display text-maroon text-lg">Each stall</h3>
        <div className="border-maroon/15 overflow-x-auto border bg-white/50">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className={head}>
              <tr>
                <th className={`${th} sticky left-0 z-10 bg-[#fdf9f4]`}>
                  Stall
                </th>
                <th className={`${th} text-right`}>Days</th>
                <th className={`${th} text-right`}>Bills</th>
                <th className={`${th} text-right`}>Takings</th>
                <th className={`${th} text-right`}>Per day</th>
                <th className={`${th} text-right`}>Average bill</th>
                <th className={`${th} text-right`}>Offers</th>
                <th className={`${th} text-right`}>Stall costs</th>
                <th className={`${th} text-right`}>Goods cost</th>
                <th className={`${th} text-right`}>Profit</th>
                <th className={th}>Break-even</th>
              </tr>
            </thead>
            <tbody className="divide-maroon/10 divide-y">
              {newest.map((s) => (
                <tr key={s.name}>
                  <td className="sticky left-0 z-10 bg-[#fdf9f4] px-3 py-2.5">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-ink/45 text-xs">
                      {s.from ? prettyRange(s.from, s.to) : ""}
                      {s.top ? `${s.from ? " · " : ""}top: ${s.top.name}` : ""}
                    </div>
                  </td>
                  <td className={num}>{s.days}</td>
                  <td className={num}>{s.bills}</td>
                  <td className={`${num} text-maroon font-semibold`}>
                    {inr(s.takings)}
                  </td>
                  <td className={num}>{s.days ? inr(s.perDay) : "—"}</td>
                  <td className={num}>{s.bills ? inr(s.average) : "—"}</td>
                  <td
                    className={`${num} ${s.offers > 0 ? "text-loss" : "text-ink/30"}`}
                    title={
                      s.gross
                        ? `${shareText(s.offers, s.gross)} of sales`
                        : undefined
                    }
                  >
                    {s.offers > 0 ? `−${inr(s.offers)}` : "—"}
                  </td>
                  <td
                    className={`${num} text-ink/70`}
                    title={s.costs
                      .map((c) => `${c.label} ${inr(c.amount)}`)
                      .join(", ")}
                  >
                    {s.stallCosts ? inr(s.stallCosts) : "—"}
                  </td>
                  <td className={`${num} text-ink/70`}>
                    {s.anyGoodsCost ? inr(s.goods) : "—"}
                  </td>
                  <td className={num}>
                    <ProfitCell s={s} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <BreakEven s={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ink/50 text-xs">
          Profit = takings (after offers) − the cost price of the goods sold −
          what the stall cost to run. Add stall costs in Settings → Stalls, and
          a cost price per item on the Items screen. A <strong>*</strong> means
          some pieces sold have no cost price, so the real profit is lower.
          Break-even is where takings cover the stall’s costs at that stall’s
          margin on goods.
          {looseBills > 0
            ? ` ${looseBills} bill${looseBills === 1 ? " has" : "s have"} no stall and ${looseBills === 1 ? "is" : "are"} left out.`
            : ""}
        </p>
      </section>

      {withBills.length >= 2 && (
        <section className="space-y-2">
          <h3 className="font-display text-maroon text-lg">
            Compare two stalls
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              ["First", a, (v: string) => setPick({ a: v, b })],
              ["Second", b, (v: string) => setPick({ a, b: v })],
            ].map(([label, value, set]) => (
              <select
                key={label as string}
                value={value as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
                aria-label={`${label as string} stall to compare`}
                className={select}
              >
                {withBills.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {sa && sb && (
            <div className="border-maroon/15 overflow-x-auto border bg-white/50">
              <table className="w-full min-w-[26rem] text-left text-sm">
                <thead className={head}>
                  <tr>
                    <th className={th} />
                    <th className={`${th} text-right`}>{sa.name}</th>
                    <th className={`${th} text-right`}>{sb.name}</th>
                    <th className={`${th} text-right`}>Change</th>
                  </tr>
                </thead>
                <tbody className="divide-maroon/10 divide-y">
                  {rows.map((r) => {
                    const x = r.get(sa);
                    const y = r.get(sb);
                    return (
                      <tr key={r.label}>
                        <td className="px-3 py-2.5">{r.label}</td>
                        <td className={num}>{x === null ? "—" : r.show(x)}</td>
                        <td className={`${num} text-maroon font-semibold`}>
                          {y === null ? "—" : r.show(y)}
                        </td>
                        <td className={num}>
                          {x !== null && y !== null ? (
                            <Delta from={x} to={y} better={r.better} />
                          ) : (
                            <span className="text-ink/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-3 py-2.5">Top product</td>
                    <td className={`${num} text-ink/70`}>
                      {sa.top?.name ?? "—"}
                    </td>
                    <td className={`${num} text-ink/70`}>
                      {sb.top?.name ?? "—"}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-ink/50 text-xs">
            Change is the second stall against the first. Green is better, red
            is worse (more offers or costs count as worse). Stalls run for
            different numbers of days, so “takings per day” is the fairest
            comparison.
          </p>
        </section>
      )}
    </div>
  );
}
