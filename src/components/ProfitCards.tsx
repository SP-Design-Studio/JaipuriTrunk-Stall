"use client";

import { useMemo } from "react";
import type { Catalog } from "@/lib/catalog";
import { inr } from "@/lib/money";
import { profitSummary } from "@/lib/profitSummary";
import type { Sale, StallEntry } from "@/lib/types";

/**
 * Profit or loss, and break-even, for the stalls in the list. Two cards in the
 * same style as the figures around them; without any costs entered they say where
 * to add them instead of showing a number that means nothing.
 */
export default function ProfitCards({
  shown,
  sales,
  stalls,
  catalog,
}: {
  shown: Sale[];
  sales: Sale[];
  stalls: StallEntry[];
  catalog: Catalog | null;
}) {
  const p = useMemo(
    () => profitSummary(shown, sales, stalls, catalog),
    [shown, sales, stalls, catalog],
  );
  const card = (title: string, value: React.ReactNode, sub: string) => (
    <div className="border-maroon/15 border bg-white/50 p-4">
      <div className="text-olive/80 text-xs tracking-[0.18em] uppercase">
        {title}
      </div>
      <div className="font-display mt-1 text-2xl">{value}</div>
      <div className="text-ink/45 mt-0.5 text-xs">{sub}</div>
    </div>
  );
  const none = <span className="text-ink/30">—</span>;
  const scope = `${p.label}${p.wholeStall ? ", the whole stall" : ""}`;

  return (
    <>
      {card(
        "Profit / loss",
        p.hasCosts ? (
          <span className={p.profit < 0 ? "text-loss" : "text-gain"}>
            {p.profit < 0 ? "−" : "+"}
            {inr(Math.abs(p.profit))}
            {p.partial && <span className="text-ink/45 text-base"> *</span>}
          </span>
        ) : (
          none
        ),
        p.hasCosts
          ? `${scope}${p.partial ? " · * some items have no cost price" : ""}`
          : "add costs in Items and Settings → Stalls",
      )}
      {card(
        "Break-even",
        p.hasStallCosts ? (
          p.gap <= 0 ? (
            <span className="text-gain">Covered</span>
          ) : (
            <span className="text-loss">{inr(p.gap)} to go</span>
          )
        ) : (
          none
        ),
        p.hasStallCosts
          ? p.gap <= 0
            ? `${inr(-p.gap)} to spare · ${scope}`
            : p.breakEvenTakings !== null
              ? `breaks even at ${inr(p.breakEvenTakings)} takings`
              : scope
          : "add the stall’s costs in Settings → Stalls",
      )}
    </>
  );
}
