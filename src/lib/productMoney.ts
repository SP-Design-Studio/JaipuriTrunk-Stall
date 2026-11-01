import type { Catalog } from "./catalog";
import type { Line, Sale } from "./types";

/**
 * Money by product. A bill's offer belongs to the whole bill, so to say what each
 * product earned AFTER offers it is spread across the bill's lines in proportion
 * to what each line came to. The spread is done in whole rupees and always adds
 * back to the offer exactly, so across every product:
 *
 *   gross (before offers) - offers = net = Takings
 *
 * to the rupee. (The existing "What sold" tab shows the gross figure.)
 */
export type MoneyLine = {
  sale: Sale;
  line: Line;
  gross: number;
  offer: number;
  net: number;
};

export function moneyLines(sales: Sale[]): MoneyLine[] {
  const out: MoneyLine[] = [];
  for (const sale of sales) {
    const gross = sale.lines.map((l) => l.price * l.qty);
    const subtotal = gross.reduce((n, g) => n + g, 0);
    const off = sale.discountAmount;
    // Whole-rupee shares, rounded down...
    const share = gross.map((g) =>
      subtotal ? Math.floor((off * g) / subtotal) : 0,
    );
    // ...then the rupees left over go to the lines with the biggest remainders,
    // so the shares add up to the offer exactly.
    let left = off - share.reduce((n, x) => n + x, 0);
    const order = gross
      .map((g, i) => ({ i, rem: subtotal ? (off * g) % subtotal : 0 }))
      .sort((a, b) => b.rem - a.rem || gross[b.i] - gross[a.i]);
    for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length) {
      share[order[k].i] += 1;
      left -= 1;
    }
    sale.lines.forEach((line, i) =>
      out.push({
        sale,
        line,
        gross: gross[i],
        offer: share[i],
        net: gross[i] - share[i],
      }),
    );
  }
  return out;
}

/** Which product (and category) a line belongs to: by item id, else by name. */
export function catalogResolver(catalog: Catalog | null) {
  const byId = new Map<string, { name: string; category: string }>();
  const byName = new Map<string, { id: string; category: string }>();
  for (const c of catalog?.categories ?? [])
    for (const i of c.items) {
      byId.set(i.id, { name: i.name, category: c.title });
      byName.set(i.name.trim().toLowerCase(), { id: i.id, category: c.title });
    }
  return (l: Line) => {
    const hit = l.itemId ? byId.get(l.itemId) : undefined;
    if (hit)
      return { key: l.itemId as string, name: l.name, category: hit.category };
    const named = byName.get(l.name.trim().toLowerCase());
    if (named) return { key: named.id, name: l.name, category: named.category };
    // A one-off "other item", or one that has since been removed from the list.
    return {
      key: `name:${l.name.trim().toLowerCase()}`,
      name: l.name,
      category: "Other / one-off",
    };
  };
}

export type ProductRow = {
  key: string;
  name: string;
  category: string;
  pieces: number;
  gross: number;
  offer: number;
  net: number;
};

export function productRows(
  lines: MoneyLine[],
  resolve: ReturnType<typeof catalogResolver>,
): ProductRow[] {
  const m = new Map<string, ProductRow>();
  for (const x of lines) {
    const r = resolve(x.line);
    const cur = m.get(r.key) ?? {
      key: r.key,
      name: r.name,
      category: r.category,
      pieces: 0,
      gross: 0,
      offer: 0,
      net: 0,
    };
    cur.pieces += x.line.qty;
    cur.gross += x.gross;
    cur.offer += x.offer;
    cur.net += x.net;
    m.set(r.key, cur);
  }
  return [...m.values()];
}

/** Price points, by the price one piece sold at. */
export const PRICE_BANDS = [
  { label: "Under ₹500", below: 500 },
  { label: "₹500 to ₹699", below: 700 },
  { label: "₹700 to ₹899", below: 900 },
  { label: "₹900 to ₹1,199", below: 1200 },
  { label: "₹1,200 and above", below: Infinity },
] as const;

export const bandOf = (price: number) =>
  PRICE_BANDS.findIndex((b) => price < b.below);
