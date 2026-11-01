import type { Catalog } from "./catalog";
import { stallStats } from "./stallStats";
import type { Sale, StallEntry } from "./types";

/**
 * Profit or loss and break-even for the stalls in a list of bills. A stall's costs
 * are fixed however many days are on show, so the figures always cover the whole
 * stall (every bill made at it), and `wholeStall` says when the list shows less.
 */
export type ProfitSummary = {
  /** Any cost price or stall cost to work from. */
  hasCosts: boolean;
  /** Any stall cost, so break-even means something. */
  hasStallCosts: boolean;
  profit: number;
  /** Still to earn to cover the stall costs; negative once covered. */
  gap: number;
  /** Takings needed to break even, when the list is a single stall. */
  breakEvenTakings: number | null;
  /** Some pieces sold have no cost price, so the profit is overstated. */
  partial: boolean;
  /** The stall's name, or how many stalls. */
  label: string;
  /** The list shows only part of the stall (for example, just today). */
  wholeStall: boolean;
};

export function profitSummary(
  shown: Sale[],
  all: Sale[],
  stalls: StallEntry[],
  catalog: Catalog | null,
): ProfitSummary {
  const names = new Set(
    shown.map((s) => s.stall?.name).filter(Boolean) as string[],
  );
  const stats = stallStats(all, stalls, catalog).filter((s) =>
    names.has(s.name),
  );
  const inList = (n: string) => shown.filter((s) => s.stall?.name === n).length;
  return {
    hasCosts: stats.some((s) => s.anyGoodsCost || s.stallCosts > 0),
    hasStallCosts: stats.some((s) => s.stallCosts > 0),
    profit: stats.reduce((n, s) => n + s.profit, 0),
    gap: stats.reduce((n, s) => n + s.gap, 0),
    breakEvenTakings: stats.length === 1 ? stats[0].breakEvenTakings : null,
    partial: stats.some((s) => s.unknownPieces > 0),
    label:
      stats.length === 1
        ? stats[0].name
        : `${stats.length} ${stats.length === 1 ? "stall" : "stalls"}`,
    wholeStall: stats.some((s) => s.bills > inList(s.name)),
  };
}
