import type { Catalog } from "./catalog";
import { invoiceNoFor, seqOf } from "./time";
import type { Discount, Line, PaymentMode, Review, Sale, Stall } from "./types";

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
  stall?: Stall | null;
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
  // Left out when there is none, so a database that has not been given the
  // stall column yet still accepts sales from a till with no stalls set up.
  ...(s.stall ? { stall: s.stall } : {}),
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
  ...(r.stall ? { stall: r.stall } : {}),
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
export async function insertSale(
  sale: Sale,
): Promise<{ sale: Sale; created: boolean } | "busy"> {
  const existing = await findSale(sale.id);
  if (existing) return { sale: existing, created: false };

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
    if (put.ok) return { sale: numbered, created: true };
    const detail = await put.text();
    if (put.status !== 409 && !detail.includes('"23505"'))
      throw new Error(`supabase responded ${put.status}: ${detail}`);
    // Either the same sale arrived twice at once, or the number was taken.
    const again = await findSale(sale.id);
    if (again) return { sale: again, created: false };
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

/** Puts back a sale from a backup, keeping its bill number. */
export async function restoreSale(
  sale: Sale,
): Promise<"added" | "skipped" | "conflict"> {
  if (await findSale(sale.id)) return "skipped";
  const res = await fetch(`${base()}/rest/v1/stall_sales`, {
    method: "POST",
    headers: { ...headers(), prefer: "return=minimal" },
    body: JSON.stringify(toRow(sale)),
  });
  if (res.ok) return "added";
  const detail = await res.text();
  if (res.status === 409 || detail.includes('"23505"')) return "conflict";
  throw new Error(`supabase responded ${res.status}: ${detail}`);
}

/** Removes every sale. PostgREST insists on a filter, so this matches all ids. */
export async function deleteAllSales(): Promise<void> {
  const res = await fetch(
    `${base()}/rest/v1/stall_sales?id=neq.00000000-0000-0000-0000-000000000000`,
    { method: "DELETE", headers: headers() },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
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

/**
 * Stock: one row per item that has a count (stall_stock, migration 0004). Items
 * with no row are simply not tracked. If the migration hasn't been run these
 * throw; callers treat stock as optional so selling never depends on it.
 */
export async function getStock(): Promise<Record<string, number>> {
  const res = await fetch(
    `${base()}/rest/v1/stall_stock?select=item_id,quantity`,
    {
      headers: headers(),
      cache: "no-store",
    },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as { item_id: string; quantity: number }[];
  return Object.fromEntries(rows.map((r) => [r.item_id, r.quantity]));
}

/** Sets an item's count, or stops tracking it with null. */
export async function setStock(
  itemId: string,
  quantity: number | null,
): Promise<void> {
  const res =
    quantity === null
      ? await fetch(
          `${base()}/rest/v1/stall_stock?item_id=eq.${encodeURIComponent(itemId)}`,
          { method: "DELETE", headers: headers() },
        )
      : await fetch(`${base()}/rest/v1/stall_stock`, {
          method: "POST",
          headers: {
            ...headers(),
            prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            item_id: itemId,
            quantity,
            updated_at: new Date().toISOString(),
          }),
        });
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
}

/** Lowers counts for what just sold: per item, in one database step each. */
export async function consumeStock(
  taken: Record<string, number>,
): Promise<void> {
  for (const [itemId, qty] of Object.entries(taken)) {
    const res = await fetch(`${base()}/rest/v1/rpc/stall_decrement_stock`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_item: itemId, p_qty: qty }),
    });
    if (!res.ok)
      throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  }
}

/**
 * Reviews (stall_reviews, migration 0005). The bill's id is the key, so a second
 * review of the same bill is refused by the database itself. If the migration has
 * not been run these throw; the receipt page treats that as "no review prompt".
 */
type ReviewRow = {
  sale_id: string;
  rating: number;
  comment: string;
  show_public: boolean;
  first_name: string;
  invoice_no: string;
  stall_name: string;
  created_at: string;
};

const fromReviewRow = (r: ReviewRow): Review => ({
  saleId: r.sale_id,
  rating: r.rating,
  comment: r.comment,
  showPublic: r.show_public,
  firstName: r.first_name,
  invoiceNo: r.invoice_no,
  stallName: r.stall_name,
  createdAt: r.created_at,
});

export async function insertReview(r: Review): Promise<"ok" | "exists"> {
  const res = await fetch(`${base()}/rest/v1/stall_reviews`, {
    method: "POST",
    headers: { ...headers(), prefer: "return=minimal" },
    body: JSON.stringify({
      sale_id: r.saleId,
      rating: r.rating,
      comment: r.comment,
      show_public: r.showPublic,
      first_name: r.firstName,
      invoice_no: r.invoiceNo,
      stall_name: r.stallName,
    }),
  });
  if (res.ok) return "ok";
  const detail = await res.text();
  if (res.status === 409 || detail.includes('"23505"')) return "exists";
  throw new Error(`supabase responded ${res.status}: ${detail}`);
}

export async function findReview(saleId: string): Promise<Review | null> {
  const res = await fetch(
    `${base()}/rest/v1/stall_reviews?select=*&sale_id=eq.${encodeURIComponent(saleId)}&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  const [row] = (await res.json()) as ReviewRow[];
  return row ? fromReviewRow(row) : null;
}

export async function listReviews(limit = 500): Promise<Review[]> {
  const res = await fetch(
    `${base()}/rest/v1/stall_reviews?select=*&order=created_at.desc&limit=${limit}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok)
    throw new Error(`supabase responded ${res.status}: ${await res.text()}`);
  return ((await res.json()) as ReviewRow[]).map(fromReviewRow);
}
