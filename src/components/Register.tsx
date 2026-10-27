"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { tilesOf, type Catalog, type Tile } from "@/lib/catalog";
import { inr, lineTotal, totalsFor } from "@/lib/money";
import type { Discount, Line, PaymentMode, Sale, Stall } from "@/lib/types";
import Modal from "./Modal";
import StockBadge from "./StockBadge";
import { useToast } from "./Toasts";
import type { SaveResult } from "./useSales";

const input =
  "bg-cream border-maroon/25 focus:border-maroon w-full border px-3 py-2.5 text-base outline-none";
const label = "text-olive/80 mb-1 block text-xs tracking-[0.18em] uppercase";
const chip = (on: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center border px-4 text-sm whitespace-nowrap transition-colors ${
    on
      ? "bg-maroon border-maroon text-cream"
      : "border-maroon/25 text-maroon hover:bg-petal"
  }`;

const wholeRupees = (raw: string) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null;
};

export default function Register({
  catalog,
  qr,
  stock,
  stall,
  onSave,
  onCheck,
}: {
  catalog: Catalog;
  /** Where this till is today; printed on the receipt and saved with the bill. */
  stall?: Stall;
  /** Pieces in stock per item id; null if stock cannot be read. Items not listed are not counted. */
  stock: Record<string, number> | null;
  /** The uploaded UPI QR: undefined while loading, null if none yet. */
  qr: string | null | undefined;
  /** Resolves once the database has answered. The receipt opens only on "saved". */
  onSave: (sale: Sale) => Promise<SaveResult>;
  /** Asks the database whether a sale landed. Used after a failure that may have. */
  onCheck: (sale: Sale) => Promise<"saved" | "missing" | "unknown">;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState<Discount>({ kind: "none" });
  const [flatText, setFlatText] = useState("");
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const toast = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  /** Phones only: the bill is a full-screen sheet over the items. */
  const [billOpen, setBillOpen] = useState(false);
  const [cashIn, setCashIn] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOk, setMarketingOk] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [error, setError] = useState("");

  /**
   * The sale being saved, held still. After a failed save the SAME sale (same id,
   * same lines) is what gets retried, and the bill is locked until it is sorted
   * out: if the first attempt actually reached the database, sending a changed
   * bill under the same id would be silently ignored, and sending it under a new
   * id would count the customer twice.
   */
  const [frozen, setFrozen] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    maybeSaved: boolean;
  } | null>(null);
  const locked = saving || frozen !== null;

  const [sizeFor, setSizeFor] = useState<Tile | null>(null);
  const [colorFor, setColorFor] = useState<{
    item: Tile;
    size?: string;
  } | null>(null);
  const [priceFor, setPriceFor] = useState<{
    item: Tile;
    size?: string;
    color?: string;
  } | null>(null);
  const [priceText, setPriceText] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const totals = totalsFor(lines, discount);
  const received = Number(cashIn) || 0;

  /**
   * The category chosen may have been deleted from the Items screen since; fall
   * back to "all" rather than showing an empty register with no explanation.
   */
  const activeCat = catalog.categories.some((c) => c.id === cat) ? cat : "all";

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tilesOf(catalog).filter(
      (i) =>
        (activeCat === "all" || i.categoryId === activeCat) &&
        (!q || i.name.toLowerCase().includes(q)),
    );
  }, [catalog, query, activeCat]);

  type Variant = { size?: string; color?: string };

  /** How many of an item are already on this bill (all sizes and colours). */
  const inBill = (itemId?: string) =>
    itemId
      ? lines.reduce((n, l) => (l.itemId === itemId ? n + l.qty : n), 0)
      : 0;

  /** Whether one more of this item can go on the bill; says so if not. */
  function haveStock(itemId?: string): boolean {
    const have = itemId ? stock?.[itemId] : undefined;
    if (have === undefined || !itemId) return true;
    if (inBill(itemId) < have) return true;
    toast.warning(
      have === 0 ? "That item is sold out." : `Only ${have} in stock.`,
    );
    return false;
  }

  function addLine(
    name: string,
    price: number,
    v: Variant = {},
    itemId?: string,
  ) {
    if (!haveStock(itemId)) return;
    const key = `${name}|${v.size ?? ""}|${v.color ?? ""}|${price}`;
    setLines((cur) => {
      const hit = cur.find((l) => l.key === key);
      if (hit)
        return cur.map((l) =>
          l.key === key ? { ...l, qty: Math.min(99, l.qty + 1) } : l,
        );
      return [
        ...cur,
        {
          key,
          name,
          price,
          qty: 1,
          ...(v.size ? { size: v.size } : {}),
          ...(v.color ? { color: v.color } : {}),
          ...(itemId ? { itemId } : {}),
        },
      ];
    });
    setError("");
  }

  /** Size, then colour, then price if there is none, then the bill. Each only if it applies. */
  function pick(item: Tile, v: Variant = {}) {
    if (item.sizes.length > 0 && v.size === undefined) return setSizeFor(item);
    if (item.colors.length > 0 && v.color === undefined)
      return setColorFor({ item, size: v.size });
    if (item.price === null) {
      setPriceText("");
      return setPriceFor({ item, ...v });
    }
    addLine(item.name, item.price, v, item.id);
  }

  function setQty(key: string, delta: number) {
    if (delta > 0 && !haveStock(lines.find((l) => l.key === key)?.itemId))
      return;
    setLines((cur) =>
      cur
        .map((l) =>
          l.key === key ? { ...l, qty: Math.min(99, l.qty + delta) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function applyFlat(text: string) {
    setFlatText(text);
    const n = Number(text);
    setDiscount(
      Number.isInteger(n) && n > 0
        ? { kind: "flat", value: n }
        : { kind: "none" },
    );
  }

  function choose(d: Discount) {
    setFlatText("");
    setDiscount(d);
  }

  async function attempt(sale: Sale) {
    setSaving(true);
    setFailure(null);
    const result = await onSave(sale);
    setSaving(false);
    // Saved: the shell opens the receipt, and closing it clears this till.
    if (result.status === "saved") return;
    setFailure({ message: result.message, maybeSaved: result.maybeSaved });
  }

  function complete() {
    if (frozen) return void attempt(frozen);
    if (lines.length === 0) return setError("Add something to the bill first.");
    if (!name.trim()) return setError("Add the customer’s name.");
    if (phone && !/^[6-9]\d{9}$/.test(phone))
      return setError(
        "Phone should be a 10-digit Indian mobile number, or leave it empty.",
      );
    if (marketingOk && !phone)
      return setError("Add their number to message them, or untick the box.");

    const now = new Date();
    const sale: Sale = {
      id: crypto.randomUUID(),
      invoiceNo: "", // the server numbers the bill when it saves it
      createdAt: now.toISOString(),
      customerName: name.trim(),
      customerPhone: phone,
      marketingOk,
      lines,
      discount,
      paymentMode: mode,
      ...(stall ? { stall } : {}),
      ...totals,
    };
    setFrozen(sale);
    void attempt(sale);
  }

  /** Let the bill be changed again — but only once it is certain nothing was saved. */
  async function editBill() {
    if (!frozen) return;
    if (failure?.maybeSaved) {
      setSaving(true);
      const found = await onCheck(frozen);
      setSaving(false);
      if (found === "saved") return; // the receipt opens; nothing left to edit
      if (found === "unknown")
        return setFailure({
          message: "Can’t check right now. Try again in a moment.",
          maybeSaved: true,
        });
    }
    setFrozen(null);
    setFailure(null);
  }

  const isPct = (v: number) => discount.kind === "pct" && discount.value === v;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[1fr_360px] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[1fr_400px]">
      {/* ── Catalogue ─────────────────────────────────────────────── */}
      <section
        inert={locked}
        className="flex min-h-0 flex-col md:col-start-1 md:row-start-1 md:border-r md:border-maroon/15"
      >
        <div className="space-y-3 p-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items"
              inputMode="search"
              className={input}
              aria-label="Search items"
            />
            <button
              onClick={() => setCustomOpen(true)}
              className={`${chip(false)} px-5`}
            >
              + Other item
            </button>
          </div>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            <button
              onClick={() => setCat("all")}
              className={chip(activeCat === "all")}
            >
              All
            </button>
            {catalog.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={chip(activeCat === c.id)}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-3 pt-0 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <button
              key={item.id}
              onClick={() => pick(item)}
              disabled={
                stock?.[item.id] !== undefined &&
                stock[item.id] - inBill(item.id) <= 0
              }
              className="border-maroon/15 hover:border-maroon/50 active:bg-petal flex flex-col border bg-white/50 text-left transition-colors disabled:opacity-50"
            >
              <div className="bg-petal/50 relative aspect-square w-full">
                {item.src?.startsWith("/api/") ? (
                  // Uploaded photo: already tile-sized, served by our own API.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt=""
                    className="absolute inset-0 size-full object-contain"
                  />
                ) : item.src ? (
                  <Image
                    src={item.src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 14vw, 30vw"
                    className="object-contain p-2"
                  />
                ) : (
                  <span className="font-display text-maroon/40 absolute inset-0 grid place-items-center px-2 text-center text-sm">
                    {item.name}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-ink text-sm leading-snug">{item.name}</div>
                {/* Price on the left, stock on the right, both easy to read. */}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-maroon text-lg leading-none font-bold">
                    {item.price === null ? "Set price" : inr(item.price)}
                  </span>
                  {stock?.[item.id] !== undefined && (
                    <StockBadge left={stock[item.id] - inBill(item.id)} />
                  )}
                </div>
              </div>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="text-ink/50 col-span-full py-10 text-center text-sm">
              {catalog.categories.some((c) => c.items.length > 0)
                ? "Nothing matches. Use “+ Other item” to add it by hand."
                : "The item list is empty. Add categories and items on the Items tab, or use “+ Other item” for a one-off."}
            </p>
          )}
        </div>
      </section>

      {/* ── Bill ──────────────────────────────────────────────────── */}
      {/* Phones: a bar under the items opens the bill as a full-screen sheet. */}
      <div className="border-maroon/15 bg-cream border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <button
          onClick={() => setBillOpen(true)}
          className="bg-maroon text-cream flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold"
        >
          <span>
            View bill · {lines.reduce((n, l) => n + l.qty, 0)} item
            {lines.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"}
          </span>
          <span>{inr(totals.total)}</span>
        </button>
      </div>

      <section
        className={`${billOpen ? "fixed inset-0 z-40 flex" : "hidden"} bg-cream md:bg-petal/40 min-h-0 flex-col md:static md:z-auto md:col-start-2 md:row-start-1 md:flex`}
      >
        <div className="border-maroon/15 flex items-center justify-between border-b px-2 md:hidden">
          <button
            onClick={() => setBillOpen(false)}
            className="text-maroon min-h-12 px-3 text-sm font-semibold"
          >
            ← Items
          </button>
          <span className="font-display text-maroon pr-3 text-lg">Bill</span>
        </div>
        <div inert={locked} className="min-h-[88px] flex-1 overflow-y-auto p-3">
          {lines.length === 0 ? (
            <p className="text-ink/45 py-10 text-center text-sm">
              Tap an item to start the bill.
            </p>
          ) : (
            <ul className="divide-maroon/10 divide-y">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug">{l.name}</div>
                    <div className="text-ink/50 text-xs">
                      {l.size ? `${l.size} · ` : ""}
                      {inr(l.price)} each
                    </div>
                  </div>
                  <div className="border-maroon/20 flex items-center border">
                    <button
                      onClick={() => setQty(l.key, -1)}
                      aria-label={`One fewer ${l.name}`}
                      className="hover:bg-petal size-11 text-lg"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => setQty(l.key, 1)}
                      aria-label={`One more ${l.name}`}
                      className="hover:bg-petal size-11 text-lg"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold">
                    {inr(lineTotal(l))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          inert={locked}
          className="border-maroon/15 min-h-0 flex-none space-y-3 overflow-y-auto border-t p-3 md:max-h-[58%]"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="c-name">
                Name
              </label>
              <input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Required"
                autoComplete="off"
                className={input}
              />
            </div>
            <div>
              <label className={label} htmlFor="c-phone">
                WhatsApp
              </label>
              <input
                id="c-phone"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                inputMode="numeric"
                placeholder="10 digits"
                autoComplete="off"
                className={input}
              />
            </div>
          </div>
          <label className="text-ink/70 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={marketingOk}
              onChange={(e) => setMarketingOk(e.target.checked)}
              className="accent-maroon size-5"
            />
            They’re happy to hear about our launch
          </label>

          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className={label}>Discount</span>
              {totals.discountAmount > 0 && (
                <span className="text-maroon text-sm">
                  −{inr(totals.discountAmount)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => choose({ kind: "none" })}
                className={chip(discount.kind === "none")}
              >
                None
              </button>
              <button
                onClick={() => choose({ kind: "pct", value: 5 })}
                className={chip(isPct(5))}
              >
                5%
              </button>
              <button
                onClick={() => choose({ kind: "pct", value: 10 })}
                className={chip(isPct(10))}
              >
                10%
              </button>
              <button
                onClick={() => choose({ kind: "round10" })}
                className={chip(discount.kind === "round10")}
              >
                Round ₹10
              </button>
              <input
                value={flatText}
                onChange={(e) =>
                  applyFlat(e.target.value.replace(/\D/g, "").slice(0, 7))
                }
                inputMode="numeric"
                placeholder="₹ off"
                aria-label="Rupees off"
                className={`${input} !w-24`}
              />
            </div>
          </div>

          <div>
            <span className={label}>Paid by</span>
            <div className="grid grid-cols-2 gap-2">
              {(["UPI", "Cash"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`${chip(mode === m)} justify-center`}
                >
                  {m}
                </button>
              ))}
            </div>
            {mode === "UPI" && (
              <button
                onClick={() => setQrOpen(true)}
                disabled={!qr || totals.total <= 0}
                className={`${chip(false)} mt-2 w-full justify-center disabled:opacity-45`}
              >
                {qr
                  ? `Show UPI QR · ${inr(totals.total)}`
                  : qr === null
                    ? "No UPI QR yet — add it in Settings"
                    : "Loading UPI QR…"}
              </button>
            )}
            {mode === "Cash" && (
              <div className="mt-2 flex items-center gap-3">
                <input
                  value={cashIn}
                  onChange={(e) =>
                    setCashIn(e.target.value.replace(/\D/g, "").slice(0, 7))
                  }
                  inputMode="numeric"
                  placeholder="Cash received"
                  aria-label="Cash received"
                  className={input}
                />
                <div className="text-sm whitespace-nowrap">
                  Change{" "}
                  <strong className="text-olive">
                    {inr(Math.max(0, received - totals.total))}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pinned: the total and the button must never scroll out of reach.
            On an iPad in landscape the form above is taller than the panel,
            and "Complete sale" was the thing that fell off the bottom. */}
        <div className="border-maroon/25 bg-cream flex-none space-y-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-ink text-lg">Total</span>
            <span className="font-display text-maroon text-3xl">
              {inr(totals.total)}
            </span>
          </div>

          {failure && (
            <div
              role="alert"
              className="bg-blush/40 text-maroon-deep space-y-2 p-3 text-sm"
            >
              <p>
                <strong>Not saved.</strong> {failure.message}{" "}
                {failure.maybeSaved
                  ? "It may or may not have gone through, so don’t take payment twice."
                  : "Nothing was recorded."}
              </p>
              <button
                onClick={() => void editBill()}
                disabled={saving}
                className="underline disabled:opacity-50"
              >
                {failure.maybeSaved
                  ? "Check, then edit the bill"
                  : "Edit the bill"}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-maroon text-sm">
              {error}
            </p>
          )}
          <button
            onClick={complete}
            disabled={saving}
            className="bg-maroon text-cream hover:bg-maroon-deep inline-flex min-h-14 w-full items-center justify-center text-base font-semibold tracking-wide transition-colors disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : frozen
                ? `${failure ? "Try saving again" : "Saved"} · ${inr(frozen.total)}`
                : `Complete sale · ${inr(totals.total)}`}
          </button>
        </div>
      </section>

      {/* ── Pickers ───────────────────────────────────────────────── */}
      {sizeFor && (
        <Modal title={`${sizeFor.name}: size`} onClose={() => setSizeFor(null)}>
          <div className="grid grid-cols-4 gap-2">
            {sizeFor.sizes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  const item = sizeFor;
                  setSizeFor(null);
                  pick(item, { size: s });
                }}
                className={`${chip(false)} justify-center`}
              >
                {s}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {colorFor && (
        <Modal
          title={`${colorFor.item.name}: colour`}
          onClose={() => setColorFor(null)}
        >
          <div className="grid grid-cols-3 gap-2">
            {colorFor.item.colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  const { item, size } = colorFor;
                  setColorFor(null);
                  pick(item, { size, color: c });
                }}
                className={`${chip(false)} justify-center`}
              >
                {c}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {priceFor && (
        <Modal title={priceFor.item.name} onClose={() => setPriceFor(null)}>
          <label className={label} htmlFor="p-price">
            Price (₹)
            {[priceFor.size, priceFor.color]
              .filter(Boolean)
              .map((x) => ` · ${x}`)
              .join("")}
          </label>
          <input
            id="p-price"
            value={priceText}
            onChange={(e) =>
              setPriceText(e.target.value.replace(/\D/g, "").slice(0, 7))
            }
            inputMode="numeric"
            autoFocus
            className={input}
          />
          <button
            onClick={() => {
              const price = wholeRupees(priceText);
              if (!price) return;
              addLine(
                priceFor.item.name,
                price,
                { size: priceFor.size, color: priceFor.color },
                priceFor.item.id,
              );
              setPriceFor(null);
            }}
            disabled={!wholeRupees(priceText)}
            className="bg-maroon text-cream mt-4 min-h-12 w-full font-semibold disabled:opacity-40"
          >
            Add to bill
          </button>
        </Modal>
      )}

      {customOpen && (
        <Modal title="Other item" onClose={() => setCustomOpen(false)}>
          <label className={label} htmlFor="o-name">
            What is it
          </label>
          <input
            id="o-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={120}
            autoFocus
            className={input}
          />
          <label className={`${label} mt-3`} htmlFor="o-price">
            Price (₹)
          </label>
          <input
            id="o-price"
            value={customPrice}
            onChange={(e) =>
              setCustomPrice(e.target.value.replace(/\D/g, "").slice(0, 7))
            }
            inputMode="numeric"
            className={input}
          />
          <button
            onClick={() => {
              const price = wholeRupees(customPrice);
              if (!price || !customName.trim()) return;
              addLine(customName.trim(), price);
              setCustomName("");
              setCustomPrice("");
              setCustomOpen(false);
            }}
            disabled={!wholeRupees(customPrice) || !customName.trim()}
            className="bg-maroon text-cream mt-4 min-h-12 w-full font-semibold disabled:opacity-40"
          >
            Add to bill
          </button>
        </Modal>
      )}
      {qrOpen && qr && (
        <Modal title="Scan to pay" onClose={() => setQrOpen(false)} wide>
          <p className="font-display text-maroon text-center text-4xl">
            {inr(totals.total)}
          </p>
          {/* White card: a QR on a tinted background scans badly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="UPI QR code"
            className="mx-auto my-4 max-h-[55dvh] w-full max-w-sm bg-white object-contain p-3"
          />
          <p className="text-ink/60 text-center text-xs">
            Type the amount if their app doesn’t fill it in. Once it lands, tap
            Complete sale.
          </p>
        </Modal>
      )}
    </div>
  );
}
