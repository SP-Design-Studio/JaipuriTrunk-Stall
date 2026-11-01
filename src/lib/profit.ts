import type { Catalog } from "./catalog";
import type { ProductRow } from "./productMoney";
import type { StallEntry } from "./types";

/** What one piece of each product costs, by item id. Products with no cost are absent. */
export function costPrices(catalog: Catalog | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of catalog?.categories ?? [])
    for (const i of c.items) if (i.cost !== undefined) m.set(i.id, i.cost);
  return m;
}

/** Everything a stall cost to run, in rupees. */
export const stallCostTotal = (e?: Pick<StallEntry, "costs">) =>
  (e?.costs ?? []).reduce((n, c) => n + c.amount, 0);

export type ProductProfit = {
  /** Cost of one piece. */
  unit: number;
  /** Cost of all the pieces sold. */
  cost: number;
  /** Takings after offers, minus that cost. */
  profit: number;
  /** Profit as a share of takings, in whole percent (can be negative). */
  margin: number;
};

/**
 * Profit per product, for the ones that have a cost price. Takings are after
 * offers, so an offer comes straight out of the profit. The cost is today's cost
 * price, applied to past sales too (bills do not keep a copy of it).
 */
export function productProfits(
  rows: ProductRow[],
  costs: Map<string, number>,
): Map<string, ProductProfit> {
  const out = new Map<string, ProductProfit>();
  for (const r of rows) {
    const unit = costs.get(r.key);
    if (unit === undefined) continue;
    const cost = unit * r.pieces;
    const profit = r.net - cost;
    out.set(r.key, {
      unit,
      cost,
      profit,
      margin: r.net ? Math.round((profit / r.net) * 100) : 0,
    });
  }
  return out;
}
