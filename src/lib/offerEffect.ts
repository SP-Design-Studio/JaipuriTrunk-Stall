import type { Catalog } from "./catalog";
import { catalogResolver, moneyLines } from "./productMoney";
import type { Sale } from "./types";

/** A bill counts as "offered" if it had any money knocked off. */
export const offered = (s: Sale) => s.discountAmount > 0;

/** Bills split into the ones with an offer and the ones without. */
export type Side = {
  bills: number;
  pieces: number;
  takings: number;
  /** Pieces per bill. */
  basket: number;
  /** Takings per bill. */
  average: number;
  /** Takings per piece. */
  perPiece: number;
};

const side = (list: Sale[]): Side => {
  const pieces = list.reduce(
    (n, s) => n + s.lines.reduce((m, l) => m + l.qty, 0),
    0,
  );
  const takings = list.reduce((n, s) => n + s.total, 0);
  return {
    bills: list.length,
    pieces,
    takings,
    basket: list.length ? pieces / list.length : 0,
    average: list.length ? takings / list.length : 0,
    perPiece: pieces ? takings / pieces : 0,
  };
};

/** Fewest bills on each side before a comparison is worth reading. */
export const MIN_BILLS = 3;

export type Verdict = "paid" | "lifted" | "cut" | "few";

/**
 * Did the offer pay off? Compares money per bill with an offer against without.
 * More money per bill even after the offer: it paid off. Less money but more
 * pieces: it lifted volume without covering the discount. Less money and no
 * more pieces: it only cut the price.
 */
export function verdict(
  withOffer: { bills: number; pieces: number; money: number },
  without: { bills: number; pieces: number; money: number },
): Verdict {
  if (withOffer.bills < MIN_BILLS || without.bills < MIN_BILLS) return "few";
  const moneyWith = withOffer.money / withOffer.bills;
  const moneyWithout = without.money / without.bills;
  if (moneyWith >= moneyWithout) return "paid";
  const piecesWith = withOffer.pieces / withOffer.bills;
  const piecesWithout = without.pieces / without.bills;
  return piecesWith - piecesWithout >= 0.15 ? "lifted" : "cut";
}

export type Overall = {
  offer: Side;
  plain: Side;
  verdict: Verdict;
  given: number;
};

export function overall(sales: Sale[]): Overall {
  const offer = side(sales.filter(offered));
  const plain = side(sales.filter((s) => !offered(s)));
  return {
    offer,
    plain,
    verdict: verdict(
      { bills: offer.bills, pieces: offer.pieces, money: offer.takings },
      { bills: plain.bills, pieces: plain.pieces, money: plain.takings },
    ),
    given: sales.reduce((n, s) => n + s.discountAmount, 0),
  };
}

/** How each kind of offer did: 5%, 10%, round-off, a flat amount off. */
export function byKind(sales: Sale[]) {
  const label = (s: Sale) =>
    s.discount.kind === "pct"
      ? `${s.discount.value}% off`
      : s.discount.kind === "round10"
        ? "Rounded to ₹10"
        : "Flat amount off";
  const m = new Map<string, Sale[]>();
  for (const s of sales.filter(offered))
    m.set(label(s), [...(m.get(label(s)) ?? []), s]);
  return [...m.entries()]
    .map(([name, list]) => ({
      name,
      ...side(list),
      given: list.reduce((n, s) => n + s.discountAmount, 0),
      pctOff: Math.round(
        (list.reduce((n, s) => n + s.discountAmount, 0) /
          Math.max(
            list.reduce((n, s) => n + s.subtotal, 0),
            1,
          )) *
          100,
      ),
    }))
    .sort((a, b) => b.given - a.given);
}

export type ProductOffer = {
  key: string;
  name: string;
  /** Bills that included this product. */
  bills: number;
  offerBills: number;
  /** Offered share of this product's bills, in whole percent. */
  offerShare: number;
  /** Rupees of offer attributed to this product's lines. */
  given: number;
  /** Offer as a share of the product's price before offers. */
  pctOff: number;
  withOffer: { bills: number; pieces: number; money: number };
  without: { bills: number; pieces: number; money: number };
  verdict: Verdict;
};

/**
 * Per product: its bills with an offer against its bills without, looking only
 * at that product's own pieces and money (after the offer's share), so one
 * product's story is not blurred by what else was in the basket.
 */
export function byProduct(
  sales: Sale[],
  catalog: Catalog | null,
): ProductOffer[] {
  const resolve = catalogResolver(catalog);
  const m = new Map<
    string,
    {
      name: string;
      on: { bills: number; pieces: number; money: number };
      off: { bills: number; pieces: number; money: number };
      given: number;
      gross: number;
    }
  >();
  for (const sale of sales) {
    // One bill can have several lines of a product (sizes); count it once.
    const perProduct = new Map<
      string,
      {
        name: string;
        pieces: number;
        money: number;
        given: number;
        gross: number;
      }
    >();
    for (const x of moneyLines([sale])) {
      const r = resolve(x.line);
      const c = perProduct.get(r.key) ?? {
        name: r.name,
        pieces: 0,
        money: 0,
        given: 0,
        gross: 0,
      };
      perProduct.set(r.key, {
        name: r.name,
        pieces: c.pieces + x.line.qty,
        money: c.money + x.net,
        given: c.given + x.offer,
        gross: c.gross + x.gross,
      });
    }
    for (const [key, p] of perProduct) {
      const cur = m.get(key) ?? {
        name: p.name,
        on: { bills: 0, pieces: 0, money: 0 },
        off: { bills: 0, pieces: 0, money: 0 },
        given: 0,
        gross: 0,
      };
      const t = offered(sale) ? cur.on : cur.off;
      t.bills += 1;
      t.pieces += p.pieces;
      t.money += p.money;
      cur.given += p.given;
      cur.gross += p.gross;
      m.set(key, cur);
    }
  }
  return [...m.entries()]
    .map(([key, c]) => ({
      key,
      name: c.name,
      bills: c.on.bills + c.off.bills,
      offerBills: c.on.bills,
      offerShare: Math.round((c.on.bills / (c.on.bills + c.off.bills)) * 100),
      given: c.given,
      pctOff: c.gross ? Math.round((c.given / c.gross) * 100) : 0,
      withOffer: c.on,
      without: c.off,
      verdict: verdict(c.on, c.off),
    }))
    .sort((a, b) => b.given - a.given || b.bills - a.bills);
}
