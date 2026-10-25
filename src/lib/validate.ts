import { totalsFor } from "./money";
import {
  LIMITS,
  type Catalog,
  type CatalogCategory,
  type CatalogItem,
} from "./catalog";
import type { Discount, Line, Sale, SaleInput, Stall } from "./types";

type Result = { ok: true; sale: Sale } | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE = /^[6-9]\d{9}$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

function parseDiscount(v: unknown): Discount | null {
  if (!isObj(v)) return null;
  if (v.kind === "none" || v.kind === "round10") return { kind: v.kind };
  if (v.kind === "pct" && int(v.value, 1, 100))
    return { kind: "pct", value: v.value };
  if (v.kind === "flat" && int(v.value, 0, 1_000_000))
    return { kind: "flat", value: v.value };
  return null;
}

function parseLine(v: unknown): Line | null {
  if (!isObj(v)) return null;
  if (!text(v.key, 120) || !text(v.name, 120) || v.name.trim() === "")
    return null;
  if (!int(v.price, 1, 1_000_000) || !int(v.qty, 1, 99)) return null;
  if (v.size !== undefined && !text(v.size, 20)) return null;
  if (v.color !== undefined && !text(v.color, 20)) return null;
  return {
    key: v.key,
    name: v.name.trim(),
    price: v.price,
    qty: v.qty,
    ...(typeof v.size === "string" && v.size ? { size: v.size } : {}),
    ...(typeof v.color === "string" && v.color ? { color: v.color } : {}),
  };
}

/**
 * Everything the till sends is checked, and the totals are thrown away and
 * recomputed. The browser is the least trustworthy part of this system — it is
 * an iPad at a stall, on whatever network, running whatever version of the page
 * it last cached — so its arithmetic is treated as a suggestion.
 */
export function parseSale(
  body: unknown,
  /** Restoring a backup: keeps the bill number it had, and allows a blank name
   *  (bills from before the name was required have none). */
  restore = false,
): Result {
  if (!isObj(body)) return { ok: false, error: "Body must be an object." };

  if (typeof body.id !== "string" || !UUID.test(body.id))
    return { ok: false, error: "Bad sale id." };

  const created =
    typeof body.createdAt === "string" ? Date.parse(body.createdAt) : NaN;
  if (!Number.isFinite(created) || created > Date.now() + 24 * 3600 * 1000)
    return { ok: false, error: "Bad sale time." };

  if (
    restore &&
    (typeof body.invoiceNo !== "string" ||
      !/^JT-\d{8}-\d{6}-\d{4,}$/.test(body.invoiceNo))
  )
    return { ok: false, error: "Bad bill number." };
  if (!text(body.customerName, 80))
    return { ok: false, error: "Name is too long." };
  if (!restore && body.customerName.trim() === "")
    return { ok: false, error: "The customer’s name is needed." };
  if (
    typeof body.customerPhone !== "string" ||
    (body.customerPhone && !PHONE.test(body.customerPhone))
  )
    return {
      ok: false,
      error: "Phone must be a 10-digit Indian mobile number.",
    };
  if (typeof body.marketingOk !== "boolean")
    return { ok: false, error: "Missing consent flag." };

  if (
    !Array.isArray(body.lines) ||
    body.lines.length < 1 ||
    body.lines.length > 50
  )
    return { ok: false, error: "A sale needs between 1 and 50 lines." };
  const lines: Line[] = [];
  for (const raw of body.lines) {
    const line = parseLine(raw);
    if (!line) return { ok: false, error: "A line item is invalid." };
    lines.push(line);
  }

  const discount = parseDiscount(body.discount);
  if (!discount) return { ok: false, error: "Bad discount." };
  if (body.paymentMode !== "UPI" && body.paymentMode !== "Cash")
    return { ok: false, error: "Bad payment mode." };

  let stall: Stall | undefined;
  if (body.stall !== undefined && body.stall !== null) {
    const parsed = parseStall(body.stall);
    if (!parsed) return { ok: false, error: "Bad stall details." };
    stall = parsed;
  }

  const input: SaleInput = {
    id: body.id.toLowerCase(),
    // Given out by the server when the sale is stored; never taken from the till.
    invoiceNo: restore ? String(body.invoiceNo) : "",
    createdAt: new Date(created).toISOString(),
    customerName: body.customerName.trim(),
    customerPhone: body.customerPhone,
    marketingOk: body.marketingOk,
    lines,
    discount,
    paymentMode: body.paymentMode,
    ...(stall ? { stall } : {}),
  };
  return { ok: true, sale: { ...input, ...totalsFor(lines, discount) } };
}

const ID = /^[a-z0-9-]{1,40}$/i;

export const STALL_LIMITS = { name: 60, address: 160, phone: 30, count: 20 };

/** A stall's details: a name, and optionally an address and phone to print. */
export function parseStall(v: unknown): Stall | null {
  if (!isObj(v)) return null;
  if (
    !text(v.name, STALL_LIMITS.name) ||
    v.name.trim() === "" ||
    !text(v.address, STALL_LIMITS.address) ||
    !text(v.phone, STALL_LIMITS.phone)
  )
    return null;
  // Dates are optional (bills from before they existed have none), but if one is
  // there both are, and the end is not before the start.
  const day = (d: unknown) =>
    typeof d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  const dated = v.from !== undefined || v.to !== undefined;
  if (
    dated &&
    (!day(v.from) || !day(v.to) || (v.to as string) < (v.from as string))
  )
    return null;
  return {
    name: v.name.trim(),
    address: v.address.trim(),
    phone: v.phone.trim(),
    ...(dated ? { from: v.from as string, to: v.to as string } : {}),
  };
}

/** A list of short labels (sizes, colours): bounded, trimmed, none empty. */
function labels(v: unknown, maxCount: number, maxLen: number): string[] | null {
  if (!Array.isArray(v) || v.length > maxCount) return null;
  const out: string[] = [];
  for (const x of v) {
    if (!text(x, maxLen) || x.trim() === "") return null;
    out.push(x.trim());
  }
  return out;
}
/** Only the bundled starter photographs. Anything else would be an arbitrary URL. */
const SRC =
  /^(\/images\/products\/[a-z0-9-]+\.webp|\/api\/item-image\/[a-z0-9-]{1,40}\?v=\d{1,15})$/;

type CatalogResult =
  { ok: true; catalog: Catalog } | { ok: false; error: string };

/**
 * The saved list is checked as strictly as a sale, and for the same reason: it
 * arrives from a browser. Ids must be unique because they key the register's
 * tiles, and `src` is limited to the bundled pictures so a request cannot plant
 * a URL that the register would then try to load.
 */
export function parseCatalog(body: unknown): CatalogResult {
  if (!isObj(body) || !Array.isArray(body.categories))
    return { ok: false, error: "Body must contain categories." };
  if (body.categories.length > LIMITS.categories)
    return { ok: false, error: `At most ${LIMITS.categories} categories.` };

  const seen = new Set<string>();
  const claim = (id: string) => (seen.has(id) ? false : (seen.add(id), true));
  let items = 0;
  const categories: CatalogCategory[] = [];

  for (const rawCat of body.categories) {
    if (!isObj(rawCat)) return { ok: false, error: "A category is invalid." };
    if (
      typeof rawCat.id !== "string" ||
      !ID.test(rawCat.id) ||
      !claim(rawCat.id)
    )
      return { ok: false, error: "A category id is missing or repeated." };
    if (!text(rawCat.title, LIMITS.title) || rawCat.title.trim() === "")
      return { ok: false, error: "Every category needs a name." };

    const sizes = labels(rawCat.sizes, LIMITS.sizes, LIMITS.size);
    if (!sizes) return { ok: false, error: "Sizes are invalid." };
    // Optional, so a list saved before colours existed is still accepted.
    const colors =
      rawCat.colors === undefined
        ? []
        : labels(rawCat.colors, LIMITS.colors, LIMITS.color);
    if (!colors) return { ok: false, error: "Colours are invalid." };

    if (!Array.isArray(rawCat.items))
      return { ok: false, error: "A category has no item list." };
    const list: CatalogItem[] = [];
    for (const rawItem of rawCat.items) {
      if (++items > LIMITS.itemsTotal)
        return { ok: false, error: `At most ${LIMITS.itemsTotal} items.` };
      if (!isObj(rawItem)) return { ok: false, error: "An item is invalid." };
      if (
        typeof rawItem.id !== "string" ||
        !ID.test(rawItem.id) ||
        !claim(rawItem.id)
      )
        return { ok: false, error: "An item id is missing or repeated." };
      if (!text(rawItem.name, LIMITS.name) || rawItem.name.trim() === "")
        return { ok: false, error: "Every item needs a name." };
      if (rawItem.price !== null && !int(rawItem.price, 1, 1_000_000))
        return { ok: false, error: "A price must be whole rupees, or empty." };
      if (
        rawItem.src !== undefined &&
        (typeof rawItem.src !== "string" || !SRC.test(rawItem.src))
      )
        return { ok: false, error: "An item picture is not allowed." };
      list.push({
        id: rawItem.id,
        name: rawItem.name.trim(),
        price: rawItem.price as number | null,
        ...(typeof rawItem.src === "string" ? { src: rawItem.src } : {}),
      });
    }
    categories.push({
      id: rawCat.id,
      title: rawCat.title.trim(),
      sizes,
      colors,
      items: list,
    });
  }
  return { ok: true, catalog: { categories } };
}
