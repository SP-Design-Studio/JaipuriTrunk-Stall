import { categories as seed } from "@/lib/products";
import { TEST_PRICES, testPrice } from "./testPrices";

/**
 * What the stall sells, as data the owner edits on the iPad.
 *
 * It used to be constants in code, which meant changing a price needed a
 * developer and a deploy. Now this is the seed — what a brand-new till starts
 * with — and the live list is whatever has been saved from the Items screen,
 * kept on the iPad and mirrored to the cloud.
 *
 * Removing an item or a whole category only changes what the register offers.
 * Past sales are untouched: each one carries its own copy of the name and the
 * price it sold at, so history never rewrites itself.
 */
export type CatalogItem = {
  id: string;
  name: string;
  /** Whole rupees, or null to ask at the till. */
  price: number | null;
  /**
   * A bundled photograph. Only the starter items have one — adding a picture
   * from the iPad would need somewhere to store it, which is a separate job —
   * so anything added later shows a text tile.
   */
  src?: string;
};

export type CatalogCategory = {
  id: string;
  title: string;
  /** Sizes offered when an item here is tapped. Empty means no size question. */
  sizes: string[];
  /** Colours offered when an item here is tapped. Empty means no colour question. */
  colors: string[];
  items: CatalogItem[];
};

export type Catalog = { categories: CatalogCategory[] };

/** Offered for the starter juttis. Edit per category from the Items screen. */
const JUTTI_SIZES = [
  "UK 3",
  "UK 4",
  "UK 5",
  "UK 6",
  "UK 7",
  "UK 8",
  "UK 9",
  "UK 10",
];

export const defaultCatalog: Catalog = {
  categories: seed.map((c) => ({
    id: c.id,
    title: c.title,
    sizes: c.id === "juttis" ? JUTTI_SIZES : [],
    // No invented colours: which ones exist is the owner's to say, per category.
    colors: [],
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      // null = ask at the till. Test mode fills a made-up price instead; see
      // testPrices.ts for when that is on.
      price: TEST_PRICES ? testPrice(i.id) : null,
      src: i.src,
    })),
  })),
};

/** One tappable tile on the register, with what it needs from its category. */
export type Tile = CatalogItem & {
  categoryId: string;
  categoryTitle: string;
  sizes: string[];
  colors: string[];
};

export const tilesOf = (catalog: Catalog): Tile[] =>
  catalog.categories.flatMap((c) =>
    c.items.map((i) => ({
      ...i,
      categoryId: c.id,
      categoryTitle: c.title,
      sizes: c.sizes,
      colors: c.colors,
    })),
  );

/** Browser only — ids for things added at the till. Matches `ID` in validate.ts. */
export const newId = () => crypto.randomUUID().slice(0, 8);

/** Limits, shared so the Items screen can stop short of what the server would refuse. */
export const LIMITS = {
  categories: 30,
  itemsTotal: 400,
  name: 80,
  title: 60,
  sizes: 24,
  size: 12,
  colors: 24,
  color: 20,
} as const;

/**
 * Lists saved before colours existed have no `colors`. Fill the gap on the way
 * in so the rest of the app can rely on the field being there.
 */
export const normalize = (c: Catalog): Catalog => ({
  categories: c.categories.map((cat) => ({ ...cat, colors: cat.colors ?? [] })),
});
