import type { Catalog } from "./catalog";
import { costPrices, stallCostTotal } from "./profit";
import { catalogResolver, moneyLines } from "./productMoney";
import { dayKey } from "./time";
import type { Sale, StallCost, StallEntry } from "./types";

/** One stall's figures, from the bills recorded against it. */
export type StallStat = {
  name: string;
  /** The stall's own planned days, if it has them. */
  from?: string;
  to?: string;
  /** Days with at least one bill. */
  days: number;
  bills: number;
  pieces: number;
  /** Takings after offers. */
  takings: number;
  /** What the bills came to before offers. */
  gross: number;
  offers: number;
  average: number;
  perDay: number;
  /** Cost of the goods sold, for the pieces that have a cost price. */
  goods: number;
  /** Pieces sold with no cost price, so not in `goods`. */
  unknownPieces: number;
  /** True if any piece sold had a cost price. */
  anyGoodsCost: boolean;
  costs: StallCost[];
  stallCosts: number;
  /** Takings − goods − stall costs. Only complete if `unknownPieces` is 0. */
  profit: number;
  margin: number;
  /** What is still missing to cover the stall costs; negative once covered. */
  gap: number;
  /** Takings needed to cover the stall costs at this stall's margin, if known. */
  breakEvenTakings: number | null;
  top?: { name: string; net: number };
  /** Sold pieces per product key, for the trend. */
  pieceMap: Map<string, { name: string; pieces: number }>;
  /** Sort key: the stall's start, else its first bill. */
  starts: string;
};

/** Stats for every stall that has bills or costs, oldest first. */
export function stallStats(
  sales: Sale[],
  stalls: StallEntry[],
  catalog: Catalog | null,
): StallStat[] {
  const costs = costPrices(catalog);
  const resolve = catalogResolver(catalog);
  const names = new Map<string, Sale[]>();
  for (const s of sales) {
    const n = s.stall?.name;
    if (!n) continue;
    names.set(n, [...(names.get(n) ?? []), s]);
  }
  for (const e of stalls) if (!names.has(e.name)) names.set(e.name, []);

  const out: StallStat[] = [];
  for (const [name, list] of names) {
    const entry = stalls.find((e) => e.name === name);
    const stallCosts = stallCostTotal(entry);
    if (list.length === 0 && stallCosts === 0) continue;

    const lines = moneyLines(list);
    let goods = 0;
    let unknownPieces = 0;
    let anyGoodsCost = false;
    let pieces = 0;
    const pieceMap = new Map<string, { name: string; pieces: number }>();
    const net = new Map<string, { name: string; net: number }>();
    for (const x of lines) {
      pieces += x.line.qty;
      const r = resolve(x.line);
      const unit = costs.get(r.key);
      if (unit === undefined) unknownPieces += x.line.qty;
      else {
        goods += unit * x.line.qty;
        anyGoodsCost = true;
      }
      const p = pieceMap.get(r.key) ?? { name: r.name, pieces: 0 };
      pieceMap.set(r.key, { name: r.name, pieces: p.pieces + x.line.qty });
      const n = net.get(r.key) ?? { name: r.name, net: 0 };
      net.set(r.key, { name: r.name, net: n.net + x.net });
    }
    const takings = list.reduce((n, s) => n + s.total, 0);
    const gross = list.reduce((n, s) => n + s.subtotal, 0);
    const days = new Set(list.map((s) => dayKey(s.createdAt))).size;
    const profit = takings - goods - stallCosts;
    const goodsMargin = takings > 0 ? (takings - goods) / takings : 0;
    const top = [...net.values()].sort((a, b) => b.net - a.net)[0];
    const firstBill = list.reduce(
      (m, s) => (s.createdAt < m ? s.createdAt : m),
      "9999",
    );
    out.push({
      name,
      from: entry?.from,
      to: entry?.to,
      days,
      bills: list.length,
      pieces,
      takings,
      gross,
      offers: gross - takings,
      average: list.length ? Math.round(takings / list.length) : 0,
      perDay: days ? Math.round(takings / days) : 0,
      goods,
      unknownPieces,
      anyGoodsCost,
      costs: entry?.costs ?? [],
      stallCosts,
      profit,
      margin: takings ? Math.round((profit / takings) * 100) : 0,
      gap: stallCosts - (takings - goods),
      breakEvenTakings:
        stallCosts > 0 && goodsMargin > 0
          ? Math.ceil(stallCosts / goodsMargin)
          : null,
      top: top && top.net > 0 ? top : undefined,
      pieceMap,
      starts: entry?.from ?? firstBill,
    });
  }
  return out.sort((a, b) => a.starts.localeCompare(b.starts));
}
