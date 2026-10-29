import { readFile, writeFile } from "node:fs/promises";
import type { Catalog } from "./catalog";
import { invoiceNoFor, seqOf } from "./time";
import type { Review, Sale } from "./types";

/**
 * A stand-in for Supabase when there are no Supabase keys, so the till can be
 * tried the moment it is cloned. It is a file on the SERVER'S disk — on the
 * Mac running `npm run dev`, never on the iPad — and `store.ts` only reaches for
 * it outside production. A deployed till with no database refuses to open
 * rather than quietly keeping sales in a file Vercel would throw away.
 *
 * It copies the rules the real table enforces (the sale id is idempotent, the
 * invoice number is unique), but it is a simulation: check anything that
 * depends on database behaviour against a real project.
 */
/** Overridable so a test can use a scratch file and leave real dev data alone. */
// The path is only known at run time, so the build is told not to trace it: this
// file is never used in production (store.ts picks it only outside production),
// and tracing it would drag the whole project into the server bundle.
const FILE = process.env.STALL_DEV_DATA_FILE ?? ".stall-dev-data.json";

type Data = {
  sales: Sale[];
  catalog: { catalog: Catalog; updatedAt: string } | null;
  settings?: Record<string, unknown>;
  stock?: Record<string, number>;
  reviews?: Review[];
};

async function load(): Promise<Data> {
  try {
    return JSON.parse(
      await readFile(/*turbopackIgnore: true*/ FILE, "utf8"),
    ) as Data;
  } catch {
    return { sales: [], catalog: null };
  }
}

const save = (d: Data) =>
  writeFile(/*turbopackIgnore: true*/ FILE, JSON.stringify(d, null, 2));

export async function insertSale(
  sale: Sale,
): Promise<{ sale: Sale; created: boolean } | "busy"> {
  const d = await load();
  const seen = d.sales.find((s) => s.id === sale.id);
  if (seen) return { sale: seen, created: false };
  const last = d.sales.reduce((n, s) => Math.max(n, seqOf(s.invoiceNo)), 0);
  const numbered = {
    ...sale,
    invoiceNo: invoiceNoFor(new Date(sale.createdAt), last + 1),
  };
  d.sales.push(numbered);
  await save(d);
  return { sale: numbered, created: true };
}

export async function findSale(id: string): Promise<Sale | null> {
  return (await load()).sales.find((s) => s.id === id) ?? null;
}

export async function findByInvoice(invoiceNo: string): Promise<Sale | null> {
  return (await load()).sales.find((s) => s.invoiceNo === invoiceNo) ?? null;
}

export async function restoreSale(
  sale: Sale,
): Promise<"added" | "skipped" | "conflict"> {
  const d = await load();
  if (d.sales.some((s) => s.id === sale.id)) return "skipped";
  if (d.sales.some((s) => s.invoiceNo === sale.invoiceNo)) return "conflict";
  d.sales.push(sale);
  await save(d);
  return "added";
}

export async function deleteAllSales(): Promise<void> {
  const d = await load();
  d.sales = [];
  await save(d);
}

export async function listSales(limit = 500): Promise<Sale[]> {
  const d = await load();
  return [...d.sales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getCatalog() {
  return (await load()).catalog;
}

export async function putCatalog(catalog: Catalog): Promise<string> {
  const d = await load();
  const updatedAt = new Date().toISOString();
  d.catalog = { catalog, updatedAt };
  await save(d);
  return updatedAt;
}

export async function getSetting<T>(id: string): Promise<T | null> {
  return ((await load()).settings?.[id] as T | undefined) ?? null;
}

export async function putSetting(id: string, data: unknown): Promise<void> {
  const d = await load();
  d.settings = { ...d.settings, [id]: data };
  await save(d);
}

export async function deleteSetting(id: string): Promise<void> {
  const d = await load();
  if (d.settings) delete d.settings[id];
  await save(d);
}

export async function getStock(): Promise<Record<string, number>> {
  return { ...(await load()).stock };
}

export async function setStock(
  itemId: string,
  quantity: number | null,
): Promise<void> {
  const d = await load();
  const stock = { ...d.stock };
  if (quantity === null) delete stock[itemId];
  else stock[itemId] = quantity;
  d.stock = stock;
  await save(d);
}

export async function consumeStock(
  taken: Record<string, number>,
): Promise<void> {
  const d = await load();
  const stock = { ...d.stock };
  for (const [id, qty] of Object.entries(taken))
    if (id in stock) stock[id] = Math.max(stock[id] - qty, 0);
  d.stock = stock;
  await save(d);
}

export async function insertReview(r: Review): Promise<"ok" | "exists"> {
  const d = await load();
  const reviews = d.reviews ?? [];
  if (reviews.some((x) => x.saleId === r.saleId)) return "exists";
  d.reviews = [{ ...r, createdAt: new Date().toISOString() }, ...reviews];
  await save(d);
  return "ok";
}

export async function findReview(saleId: string): Promise<Review | null> {
  return (await load()).reviews?.find((x) => x.saleId === saleId) ?? null;
}

export async function listReviews(limit = 500): Promise<Review[]> {
  return ((await load()).reviews ?? []).slice(0, limit);
}
