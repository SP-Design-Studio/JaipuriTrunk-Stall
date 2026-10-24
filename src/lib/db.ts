import type { Catalog } from "./catalog";
import { invoiceNoFor, seqOf } from "./time";
import type { Discount, Line, PaymentMode, Sale } from "./types";

/**
 * Sales live in Supabase, reached over its REST endpoint with the service-role
 * key — which bypasses row-level security and so must stay on the server. The
 * table has RLS on and no policies, so nothing else can read it. It can be the
 * same Supabase project as the JaipuriTrunk waitlist or a separate one.
 */
const base = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export const storageConfigured = () => Boolean(base() && key());

const headers = () => ({
  apikey: key()!,
  authorization: `Bearer ${key()!}`,
  "content-type": "application/json",
});

type Row = {
  id: string;
  invoice_no: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  marketing_ok: boolean;
  lines: Line[];
  discount: Discount;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_mode: PaymentMode;
};

const toRow = (s: Sale): Row => ({
  id: s.id,
  invoice_no: s.invoiceNo,
  created_at: s.createdAt,
  customer_name: s.customerName,
  customer_phone: s.customerPhone,
  marketing_ok: s.marketingOk,
  lines: s.lines,
  discount: s.discount,
  subtotal: s.subtotal,
  discount_amount: s.discountAmount,
  total: s.total,
  payment_mode: s.paymentMode,
});

const fromRow = (r: Row): Sale => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  createdAt: r.created_at,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  marketingOk: r.marketing_ok,
  lines: r.lines,
  discount: r.discount,
  subtotal: r.subtotal,
  discountAmount: r.discount_amount,
  total: r.total,
  paymentMode: r.payment_mode,
});

const MAX_TRIES = 8;

/**
 * Stores the sale and gives it its bill number: one more than the latest bill's.
 * Returns the sale as stored, so a retry of one already saved (same id) comes back
 * with the number it was first given rather than a new one.
 *
 * Two bills saved at the same instant would both read the same "latest" and
 * reach for the same number. The unique invoice_no column lets only one win; the
 * other sees the 409, reads again and takes the next number. Only if that keeps
 * failing does the till hear about it ("busy").
 */
export async function insertSale(sale: Sale): Promise<Sale | "busy"> {
  const existing = await findSale(sale.id);
  if (existing) return existing;

  for (let i = 0; i < MAX_TRIES; i++) {
    const res = await fetch(
      `${base()}/rest/v1/stall_sales?select=invoice_no&order=inserted_at.desc&limit=1`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok)
      throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
    const [last] = (await res.json()) as { invoice_no: string }[];
    const numbered = {
      ...sale,
      invoiceNo: invoiceNoFor(
        new Date(sale.createdAt),
        seqOf(last?.invoice_no) + 1,
      ),
    };

    const put = await fetch(`${base()}/rest/v1/stall_sales`, {
      method: "POST",
      headers: { ...headers(), prefer: "return=minimal" },
      body: JSON.stringify(toRow(numbered)),
    });
    if (put.ok) return numbered;
    const detail = await put.text();
    if (put.status !== 409 && !detail.includes('"23505"'))
      throw new Error(`supabase responded ${put.status}: ${detail}`);
    // Either the same sale arrived twice at once, or the number was taken.
    const again = await findSale(sale.id);
    if (again) return again;
  }
  return "busy";
}

export async function findSale(id: string): Promise<Sale | null> {
  const res = await fetch(
    `${base()}/rest/v1/stall_sales?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const [row] = (await res.json()) as Row[];
  return row ? fromRow(row) : null;
}

export async function findByInvoice(invoiceNo: string): Promise<Sale | null> {
  const res = await fetch(
    `${base()}/rest/v1/stall_sales?select=*&invoice_no=eq.${encodeURIComponent(invoiceNo)}&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const [row] = (await res.json()) as Row[];
  return row ? fromRow(row) : null;
}

export async function listSales(limit = 500): Promise<Sale[]> {
  const res = await fetch(
    `${base()}/rest/v1/stall_sales?select=*&order=created_at.desc&limit=${limit}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  return ((await res.json()) as Row[]).map(fromRow);
}

/**
 * The catalogue is one document, not a table of items: it is edited as a whole
 * on one iPad, read as a whole by the register, and replaced as a whole. A row
 * per item would buy relational features nothing here uses, and cost a merge
 * story for what is a single person's list.
 *
 * The conflict target is the primary key (`id`, always "main"), which is exactly
 * what PostgREST infers, so `merge-duplicates` is a real upsert here.
 */
const CATALOG_ID = "main";

export async function getCatalog(): Promise<{
  catalog: Catalog;
  updatedAt: string;
} | null> {
  const res = await fetch(
    `${base()}/rest/v1/stall_catalog?id=eq.${CATALOG_ID}&select=data,updated_at`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { data: Catalog; updated_at: string }[];
  return rows[0]
    ? { catalog: rows[0].data, updatedAt: rows[0].updated_at }
    : null;
}

export async function putCatalog(catalog: Catalog): Promise<string> {
  const updatedAt = new Date().toISOString();
  const res = await fetch(`${base()}/rest/v1/stall_catalog`, {
    method: "POST",
    headers: {
      ...headers(),
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: CATALOG_ID,
      data: catalog,
      updated_at: updatedAt,
    }),
  });
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  return updatedAt;
}

/**
 * Small single-document settings (the UPI QR) share the catalogue's table, one
 * row each, so nothing new has to be created in Supabase. The row id is the
 * setting's name; the catalogue's own row is "main".
 */
export async function getSetting<T>(id: string): Promise<T | null> {
  const res = await fetch(
    `${base()}/rest/v1/stall_catalog?id=eq.${encodeURIComponent(id)}&select=data`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { data: T }[];
  return rows[0]?.data ?? null;
}

export async function putSetting(id: string, data: unknown): Promise<void> {
  const res = await fetch(`${base()}/rest/v1/stall_catalog`, {
    method: "POST",
    headers: {
      ...headers(),
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
}

export async function deleteSetting(id: string): Promise<void> {
  const res = await fetch(
    `${base()}/rest/v1/stall_catalog?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: headers() },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
}
