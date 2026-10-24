import { readFile, writeFile } from "node:fs/promises";
import type { Catalog } from "./catalog";
import { invoiceNoFor, seqOf } from "./time";
import type { Sale } from "./types";

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
const FILE = process.env.STALL_DEV_DATA_FILE ?? ".stall-dev-data.json";

type Data = {
  sales: Sale[];
  catalog: { catalog: Catalog; updatedAt: string } | null;
  settings?: Record<string, unknown>;
};

async function load(): Promise<Data> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Data;
  } catch {
    return { sales: [], catalog: null };
  }
}

const save = (d: Data) => writeFile(FILE, JSON.stringify(d, null, 2));

export async function insertSale(sale: Sale): Promise<Sale | "busy"> {
  const d = await load();
  const seen = d.sales.find((s) => s.id === sale.id);
  if (seen) return seen;
  const last = d.sales.reduce((n, s) => Math.max(n, seqOf(s.invoiceNo)), 0);
  const numbered = {
    ...sale,
    invoiceNo: invoiceNoFor(new Date(sale.createdAt), last + 1),
  };
  d.sales.push(numbered);
  await save(d);
  return numbered;
}

export async function findSale(id: string): Promise<Sale | null> {
  return (await load()).sales.find((s) => s.id === id) ?? null;
}

export async function findByInvoice(invoiceNo: string): Promise<Sale | null> {
  return (await load()).sales.find((s) => s.invoiceNo === invoiceNo) ?? null;
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
