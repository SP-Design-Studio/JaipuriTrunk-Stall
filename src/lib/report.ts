import { variantOf } from "./money";
import type { Sale } from "./types";

/** One line of one item, grouped by what made it different: size, colour, price. */
export type Variant = { label: string; price: number; qty: number };
export type ItemRow = {
  name: string;
  units: number;
  revenue: number;
  variants: Variant[];
};

/**
 * What was actually handed over, item by item.
 *
 * Grouped by name, then by size, colour and the price it sold at — the same item
 * sold at two prices is two rows, because "12 sold" hides that half went at a
 * discount. Revenue here is the sum of line totals, BEFORE any bill-level
 * discount (which belongs to the whole bill, not to one item), so it will run a
 * little above Takings on a day with discounts.
 */
export function itemRows(sales: Sale[]): ItemRow[] {
  const items = new Map<
    string,
    { units: number; revenue: number; variants: Map<string, Variant> }
  >();
  for (const sale of sales) {
    for (const l of sale.lines) {
      const item = items.get(l.name) ?? {
        units: 0,
        revenue: 0,
        variants: new Map(),
      };
      item.units += l.qty;
      item.revenue += l.price * l.qty;
      const key = `${variantOf(l)}|${l.price}`;
      const v = item.variants.get(key) ?? {
        label: variantOf(l),
        price: l.price,
        qty: 0,
      };
      v.qty += l.qty;
      item.variants.set(key, v);
      items.set(l.name, item);
    }
  }
  return [...items.entries()]
    .map(([name, i]) => ({
      name,
      units: i.units,
      revenue: i.revenue,
      variants: [...i.variants.values()].sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}
