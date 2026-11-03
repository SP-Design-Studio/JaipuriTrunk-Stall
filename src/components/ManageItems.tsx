"use client";

import { deleteItemPhoto, uploadItemPhoto } from "./photo";
import { useState } from "react";
import {
  JUTTI_SIZES,
  LIMITS,
  defaultCatalog,
  newId,
  sizesFor,
  type Catalog,
  type CatalogItem,
  type CatalogCategory,
  type SizeSet,
} from "@/lib/catalog";
import { TEST_PRICES } from "@/lib/testPrices";
import Modal from "./Modal";
import Select from "./Select";
import { useToast } from "./Toasts";
import type { SaveState } from "./useCatalog";

const box =
  "bg-cream border-maroon/25 focus:border-maroon w-full border px-3 py-2.5 text-base outline-none";
const label = "text-olive/80 mb-1 block text-xs tracking-[0.18em] uppercase";
const ghost =
  "border-maroon/30 text-maroon hover:bg-petal inline-flex min-h-11 items-center justify-center border px-4 text-sm transition-colors";
const danger =
  "text-maroon/70 hover:text-maroon hover:bg-petal inline-flex size-11 shrink-0 items-center justify-center text-xl leading-none transition-colors";

/**
 * A text box that edits a draft and commits on blur or Enter.
 *
 * Committing on every keystroke would save a half-typed name — or an empty one,
 * the instant someone selects-all to retype it — and the server refuses empty
 * names. The parent re-keys it by value so an outside change (a reset) shows.
 */
function Field({
  value,
  onCommit,
  digitsOnly = false,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  digitsOnly?: boolean;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
>) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) =>
        setDraft(
          digitsOnly
            ? e.target.value.replace(/\D/g, "").slice(0, 7)
            : e.target.value,
        )
      }
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

/** "UK 5, UK 6,,  UK 7" -> ["UK 5", "UK 6", "UK 7"], bounded the way the server is. */
const labelsOf = (v: string, maxLen: number, maxCount: number) =>
  v
    .split(",")
    .map((x) => x.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxCount);

/** Which named size option, if any, a pick like "set:abc123" stands for. */
const setIdOf = (mode: string) =>
  mode.startsWith("set:") ? mode.slice(4) : "";

/**
 * Size options: lists of sizes set up once ("Shoe sizes", "Rings") that any
 * category or item can use, so earrings do not offer shoe sizes.
 */
function SizeOptions({
  catalog,
  onChange,
}: {
  catalog: Catalog;
  onChange: (next: Catalog) => void;
}) {
  const sets = catalog.sizeSets ?? [];
  const write = (next: SizeSet[]) => onChange({ ...catalog, sizeSets: next });
  const patch = (id: string, p: Partial<SizeSet>) =>
    write(sets.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const add = (name: string, sizes: string[]) =>
    write([...sets, { id: newId(), name, sizes }]);
  // Anything that used a removed option goes back to following its category.
  const remove = (id: string) =>
    onChange({
      categories: catalog.categories.map((c) => ({
        ...c,
        sizeSet: c.sizeSet === id ? undefined : c.sizeSet,
        items: c.items.map((i) =>
          i.sizeSet === id ? { ...i, sizeSet: undefined } : i,
        ),
      })),
      sizeSets: sets.filter((s) => s.id !== id),
    });
  const usedBy = (id: string) =>
    catalog.categories.reduce(
      (n, c) =>
        n +
        (c.sizeSet === id ? 1 : 0) +
        c.items.filter((i) => i.sizeSet === id).length,
      0,
    );
  const full = sets.length >= LIMITS.sizeSets;

  return (
    <section className="border-maroon/15 space-y-3 border bg-white/50 p-3">
      <div>
        <h3 className="font-display text-maroon text-lg">Size options</h3>
        <p className="text-ink/60 text-sm">
          Set up a list of sizes once, then choose it for a category or an item
          below. Shoes can use “Shoe sizes” while earrings use none, or a
          different list.
        </p>
      </div>
      {sets.length > 0 && (
        <ul className="space-y-3">
          {sets.map((s) => (
            <li key={s.id} className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="w-full sm:w-52">
                <label className={label} htmlFor={`so-n-${s.id}`}>
                  Name
                </label>
                <Field
                  id={`so-n-${s.id}`}
                  key={`n:${s.name}`}
                  value={s.name}
                  maxLength={LIMITS.setName}
                  onCommit={(v) => v.trim() && patch(s.id, { name: v.trim() })}
                  className={box}
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <label className={label} htmlFor={`so-s-${s.id}`}>
                  Sizes, separated by commas
                </label>
                <Field
                  id={`so-s-${s.id}`}
                  key={`s:${s.sizes.join("|")}`}
                  value={s.sizes.join(", ")}
                  placeholder="UK 5, UK 6, UK 7"
                  onCommit={(v) =>
                    patch(s.id, {
                      sizes: labelsOf(v, LIMITS.size, LIMITS.sizes),
                    })
                  }
                  className={box}
                />
              </div>
              <button
                onClick={() => remove(s.id)}
                aria-label={`Remove size option ${s.name}`}
                className={danger}
              >
                ×
              </button>
              {usedBy(s.id) > 0 && (
                <span className="text-ink/45 basis-full text-xs">
                  Used by {usedBy(s.id)}{" "}
                  {usedBy(s.id) === 1 ? "place" : "places"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {!sets.some((s) => s.name === "Shoe sizes") && (
          <button
            onClick={() => add("Shoe sizes", JUTTI_SIZES)}
            disabled={full}
            className={`${ghost} disabled:opacity-40`}
          >
            + Shoe sizes (UK 3–10)
          </button>
        )}
        {!sets.some((s) => s.name === "Clothing sizes") && (
          <button
            onClick={() =>
              add("Clothing sizes", ["XS", "S", "M", "L", "XL", "XXL"])
            }
            disabled={full}
            className={`${ghost} disabled:opacity-40`}
          >
            + Clothing (XS–XXL)
          </button>
        )}
        <button
          onClick={() => add("New size option", [])}
          disabled={full}
          className={`${ghost} disabled:opacity-40`}
        >
          + Another size option
        </button>
      </div>
    </section>
  );
}

/** What a category offers: no sizes, a size option, or a list of its own. */
function CategorySizes({
  category,
  sets,
  onChange,
}: {
  category: CatalogCategory;
  sets: SizeSet[];
  onChange: (patch: Partial<CatalogCategory>) => void;
}) {
  // "A list of its own" with nothing typed yet is an empty list, which would read
  // as "none", so remember that it was picked.
  const [picked, setPicked] = useState(false);
  const chosen = sets.find((s) => s.id === category.sizeSet);
  const mode = chosen
    ? `set:${chosen.id}`
    : category.sizes.length > 0 || picked
      ? "own"
      : "none";
  return (
    <div className="min-w-0">
      <span className={label}>Sizes for items here</span>
      <Select
        value={mode}
        onChange={(next) => {
          setPicked(next === "own");
          if (next === "none") onChange({ sizeSet: undefined, sizes: [] });
          else if (next === "own") onChange({ sizeSet: undefined });
          else onChange({ sizeSet: setIdOf(next) });
        }}
        label={`Sizes for ${category.title}`}
        options={[
          { value: "none", label: "No sizes" },
          ...sets.map((s) => ({ value: `set:${s.id}`, label: s.name })),
          { value: "own", label: "A list of its own" },
        ]}
      />
      {chosen && (
        <p className="text-ink/45 mt-1 text-xs">{chosen.sizes.join(", ")}</p>
      )}
      {mode === "own" && (
        <Field
          key={`s:${category.sizes.join("|")}`}
          value={category.sizes.join(", ")}
          placeholder="UK 5, UK 6, UK 7"
          aria-label={`Sizes of ${category.title}`}
          onCommit={(v) =>
            onChange({ sizes: labelsOf(v, LIMITS.size, LIMITS.sizes) })
          }
          className={`${box} mt-2`}
        />
      )}
    </div>
  );
}

/**
 * Which sizes one item offers: its category's (the default), a size option, a
 * list of its own, or none. "Its own" starts from the category's list, so it is
 * trimmed rather than retyped.
 */
function ItemSizes({
  item,
  inherited,
  sets,
  onChange,
}: {
  item: CatalogItem;
  /** What the category offers, for the hint and as the start of "its own". */
  inherited: string[];
  sets: SizeSet[];
  onChange: (patch: {
    sizes?: string[] | undefined;
    sizeSet?: string | undefined;
  }) => void;
}) {
  const [picked, setPicked] = useState(false);
  const chosen = sets.find((s) => s.id === item.sizeSet);
  const mode = chosen
    ? `set:${chosen.id}`
    : item.sizes === undefined
      ? "same"
      : item.sizes.length > 0 || picked
        ? "own"
        : "none";
  return (
    <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-olive/80 text-xs tracking-[0.18em] uppercase">
        Sizes
      </span>
      <Select
        value={mode}
        onChange={(next) => {
          setPicked(next === "own");
          if (next === "same")
            onChange({ sizes: undefined, sizeSet: undefined });
          else if (next === "none") onChange({ sizes: [], sizeSet: undefined });
          else if (next === "own")
            onChange({ sizes: [...inherited], sizeSet: undefined });
          else onChange({ sizes: undefined, sizeSet: setIdOf(next) });
        }}
        label={`Sizes for ${item.name}`}
        className="w-56"
        options={[
          {
            value: "same",
            label:
              inherited.length > 0
                ? "Same as the category"
                : "None (category has none)",
          },
          ...sets.map((s) => ({ value: `set:${s.id}`, label: s.name })),
          { value: "own", label: "Its own sizes" },
          { value: "none", label: "No sizes" },
        ]}
      />
      {mode === "own" && (
        <Field
          key={`z:${(item.sizes ?? []).join("|")}`}
          value={(item.sizes ?? []).join(", ")}
          placeholder="UK 5, UK 6, UK 7"
          aria-label={`Sizes of ${item.name}`}
          onCommit={(v) =>
            onChange({ sizes: labelsOf(v, LIMITS.size, LIMITS.sizes) })
          }
          className={`${box} min-w-[12rem] flex-1`}
        />
      )}
      {mode === "same" && inherited.length > 0 && (
        <span className="text-ink/45 text-xs">{inherited.join(", ")}</span>
      )}
      {chosen && (
        <span className="text-ink/45 text-xs">{chosen.sizes.join(", ")}</span>
      )}
    </div>
  );
}

type Ask =
  | { kind: "category"; id: string }
  | { kind: "item"; catId: string; itemId: string }
  | { kind: "reset" };

export default function ManageItems({
  catalog,
  status,
  onChange,
  onRetry,
  stock,
  onStock,
}: {
  catalog: Catalog;
  /** Pieces in stock per item id; an item with no entry is not counted. */
  stock: Record<string, number> | null;
  /** Set an item's count, or null to stop counting it. */
  onStock: (itemId: string, quantity: number | null) => void;
  status: SaveState;
  onChange: (next: Catalog) => void;
  onRetry: () => void;
}) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const toast = useToast();

  const total = catalog.categories.reduce((n, c) => n + c.items.length, 0);

  const patchCategory = (id: string, patch: Partial<CatalogCategory>) =>
    onChange({
      ...catalog,
      categories: catalog.categories.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });

  const patchItem = (
    catId: string,
    itemId: string,
    patch: {
      name?: string;
      price?: number | null;
      cost?: number | undefined;
      sizes?: string[] | undefined;
      sizeSet?: string | undefined;
      src?: string;
    },
  ) =>
    onChange({
      ...catalog,
      categories: catalog.categories.map((c) =>
        c.id === catId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === itemId ? { ...i, ...patch } : i,
              ),
            }
          : c,
      ),
    });

  function closeAdd() {
    setAddingTo(null);
    setAddingCategory(false);
    setName("");
    setPrice("");
    setCost("");
  }

  function addItem() {
    const label = name.trim();
    if (!addingTo || !label) return;
    const p = Number(price);
    const k = Number(cost);
    patchCategory(addingTo, {
      items: [
        ...(catalog.categories.find((c) => c.id === addingTo)?.items ?? []),
        {
          id: newId(),
          name: label,
          price: Number.isInteger(p) && p > 0 ? p : null,
          ...(Number.isInteger(k) && k > 0 ? { cost: k } : {}),
        },
      ],
    });
    toast.success(`Added ${label}.`);
    closeAdd();
  }

  function addCategory() {
    const title = name.trim();
    if (!title) return;
    onChange({
      ...catalog,
      categories: [
        ...catalog.categories,
        { id: newId(), title, sizes: [], colors: [], items: [] },
      ],
    });
    toast.success(`Added the category ${title}.`);
    closeAdd();
  }

  function confirm() {
    if (!ask) return;
    if (ask.kind === "reset") {
      onChange(defaultCatalog);
      toast.info("Item list reset to the starter items.");
    } else if (ask.kind === "category") {
      onChange({
        ...catalog,
        categories: catalog.categories.filter((c) => c.id !== ask.id),
      });
      toast.info("Category removed.");
    } else {
      // A removed item's uploaded photo and stock count go with it.
      void deleteItemPhoto(ask.itemId);
      if (stock?.[ask.itemId] !== undefined) onStock(ask.itemId, null);
      onChange({
        ...catalog,
        categories: catalog.categories.map((c) =>
          c.id === ask.catId
            ? { ...c, items: c.items.filter((i) => i.id !== ask.itemId) }
            : c,
        ),
      });
      toast.info("Item removed.");
    }
    setAsk(null);
  }

  const asked =
    ask?.kind === "category"
      ? catalog.categories.find((c) => c.id === ask.id)
      : ask?.kind === "item"
        ? catalog.categories
            .find((c) => c.id === ask.catId)
            ?.items.find((i) => i.id === ask.itemId)
        : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink/60 text-sm">
            Prices left empty are asked for at the till. Type a stock number to
            count an item down as it sells; leave it empty to not count it. A
            category or item with sizes or colours asks for them when it is
            tapped. Sizes come from the size options below; an item can use a
            different one, its own list, or none. Removing something only
            changes what the register offers; past receipts keep what they sold
            for.
          </p>
          {status.kind === "failed" ? (
            <span role="alert" className="text-maroon text-xs font-semibold">
              Not saved: {status.message}.{" "}
              <button onClick={onRetry} className="underline">
                Try again
              </button>
            </span>
          ) : (
            <span role="status" className="text-ink/50 text-xs">
              {status.kind === "saving" ? "Saving…" : "Saved to the cloud"}
            </span>
          )}
        </div>

        {TEST_PRICES && (
          <p
            role="note"
            className="bg-blush/40 text-maroon-deep px-3 py-2 text-sm"
          >
            Test prices are on: the starter items carry made-up prices of ₹500
            to ₹1,000. They only apply to a fresh list or “Start again”. Set
            real prices before the real day.
          </p>
        )}

        <SizeOptions catalog={catalog} onChange={onChange} />

        {catalog.categories.length === 0 && (
          <p className="text-ink/50 py-8 text-center text-sm">
            No categories yet. Add one to start building the list.
          </p>
        )}

        {catalog.categories.map((c) => (
          <section key={c.id} className="border-maroon/15 border bg-white/50">
            <div className="border-maroon/10 space-y-3 border-b p-3">
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label className={label} htmlFor={`t-${c.id}`}>
                    Category
                  </label>
                  <Field
                    id={`t-${c.id}`}
                    key={`t:${c.title}`}
                    value={c.title}
                    maxLength={LIMITS.title}
                    onCommit={(v) =>
                      v.trim() && patchCategory(c.id, { title: v.trim() })
                    }
                    className={`${box} font-display text-lg`}
                  />
                </div>
                <button
                  onClick={() => setAsk({ kind: "category", id: c.id })}
                  aria-label={`Remove category ${c.title}`}
                  className={danger}
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CategorySizes
                  category={c}
                  sets={catalog.sizeSets ?? []}
                  onChange={(p) => patchCategory(c.id, p)}
                />
                <div>
                  <label className={label} htmlFor={`c-${c.id}`}>
                    Colours (optional)
                  </label>
                  <Field
                    id={`c-${c.id}`}
                    key={`c:${c.colors.join("|")}`}
                    value={c.colors.join(", ")}
                    placeholder="Maroon, Teal, Mustard"
                    onCommit={(v) =>
                      patchCategory(c.id, {
                        colors: labelsOf(v, LIMITS.color, LIMITS.colors),
                      })
                    }
                    className={box}
                  />
                </div>
              </div>
            </div>

            <ul className="divide-maroon/10 divide-y">
              {c.items.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
                >
                  <PhotoButton
                    item={i}
                    onChange={(src) => patchItem(c.id, i.id, { src })}
                  />
                  <Field
                    key={`n:${i.name}`}
                    value={i.name}
                    maxLength={LIMITS.name}
                    aria-label={`Name of ${i.name}`}
                    onCommit={(v) =>
                      v.trim() && patchItem(c.id, i.id, { name: v.trim() })
                    }
                    className={`${box} min-w-[9rem] flex-1`}
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="text-ink/40 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base">
                      ₹
                    </span>
                    <Field
                      key={`p:${i.price}`}
                      value={i.price === null ? "" : String(i.price)}
                      digitsOnly
                      inputMode="numeric"
                      placeholder="Ask"
                      aria-label={`Price of ${i.name}`}
                      onCommit={(v) => {
                        const n = Number(v);
                        patchItem(c.id, i.id, {
                          price: Number.isInteger(n) && n > 0 ? n : null,
                        });
                      }}
                      className={`${box} pl-7`}
                    />
                  </div>
                  <div className="relative w-28 shrink-0">
                    <span className="text-ink/40 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base">
                      ₹
                    </span>
                    <Field
                      key={`c:${i.cost ?? "none"}`}
                      value={i.cost === undefined ? "" : String(i.cost)}
                      digitsOnly
                      inputMode="numeric"
                      placeholder="Cost"
                      aria-label={`Cost price of ${i.name}`}
                      title="What one piece costs you. Only used for profit in Analysis."
                      onCommit={(v) => {
                        const n = Number(v);
                        patchItem(c.id, i.id, {
                          cost: Number.isInteger(n) && n > 0 ? n : undefined,
                        });
                      }}
                      className={`${box} pl-7`}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Field
                      key={`s:${stock?.[i.id] ?? "none"}`}
                      value={
                        stock?.[i.id] === undefined ? "" : String(stock[i.id])
                      }
                      digitsOnly
                      inputMode="numeric"
                      placeholder="Stock"
                      aria-label={`Stock of ${i.name}`}
                      onCommit={(v) => {
                        const t = v.trim();
                        const next = t === "" ? null : Number(t);
                        // Only send a real change.
                        if (next !== (stock?.[i.id] ?? null))
                          onStock(i.id, next);
                      }}
                      className={box}
                    />
                  </div>
                  <button
                    onClick={() =>
                      setAsk({ kind: "item", catId: c.id, itemId: i.id })
                    }
                    aria-label={`Remove ${i.name}`}
                    className={danger}
                  >
                    ×
                  </button>
                  <ItemSizes
                    item={i}
                    inherited={sizesFor(catalog, c, {})}
                    sets={catalog.sizeSets ?? []}
                    onChange={(p) => patchItem(c.id, i.id, p)}
                  />
                </li>
              ))}
              {c.items.length === 0 && (
                <li className="text-ink/45 px-3 py-4 text-sm">
                  Nothing in this category yet.
                </li>
              )}
            </ul>

            <div className="border-maroon/10 border-t p-3">
              <button
                onClick={() => setAddingTo(c.id)}
                disabled={total >= LIMITS.itemsTotal}
                className={`${ghost} disabled:opacity-40`}
              >
                + Add an item
              </button>
            </div>
          </section>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setAddingCategory(true)}
            disabled={catalog.categories.length >= LIMITS.categories}
            className={`${ghost} disabled:opacity-40`}
          >
            + Add a category
          </button>
          <button
            onClick={() => setAsk({ kind: "reset" })}
            className={`${ghost} border-ink/15 text-ink/60`}
          >
            Start again from the starter list
          </button>
        </div>
      </div>

      {(addingTo || addingCategory) && (
        <Modal
          title={addingCategory ? "New category" : "New item"}
          onClose={closeAdd}
        >
          <label className={label} htmlFor="add-name">
            {addingCategory ? "Category name" : "Name"}
          </label>
          <input
            id="add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={addingCategory ? LIMITS.title : LIMITS.name}
            autoFocus
            className={box}
          />
          {!addingCategory && (
            <>
              <label className={`${label} mt-3`} htmlFor="add-price">
                Price (₹), or leave empty to ask at the till
              </label>
              <input
                id="add-price"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value.replace(/\D/g, "").slice(0, 7))
                }
                inputMode="numeric"
                className={box}
              />
              <label className={`${label} mt-3`} htmlFor="add-cost">
                Cost to you (₹), optional: used for profit in Analysis
              </label>
              <input
                id="add-cost"
                value={cost}
                onChange={(e) =>
                  setCost(e.target.value.replace(/\D/g, "").slice(0, 7))
                }
                inputMode="numeric"
                className={box}
              />
            </>
          )}
          <button
            onClick={addingCategory ? addCategory : addItem}
            disabled={!name.trim()}
            className="bg-maroon text-cream mt-4 min-h-12 w-full font-semibold disabled:opacity-40"
          >
            Add
          </button>
        </Modal>
      )}

      {ask && (
        <Modal
          title={ask.kind === "reset" ? "Start again?" : "Remove this?"}
          onClose={() => setAsk(null)}
        >
          <p className="text-ink/70 mb-4 text-sm leading-relaxed">
            {ask.kind === "reset" ? (
              "This replaces the whole list with the starter one, including anything you added and every price you set."
            ) : ask.kind === "category" && asked && "items" in asked ? (
              <>
                <strong>{asked.title}</strong> and its {asked.items.length}{" "}
                {asked.items.length === 1 ? "item" : "items"} will be taken off
                the register.
              </>
            ) : asked && "name" in asked ? (
              <>
                <strong>{asked.name}</strong> will be taken off the register.
              </>
            ) : null}{" "}
            {ask.kind !== "reset" &&
              "Receipts you have already made are not affected."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setAsk(null)} className={ghost}>
              Keep it
            </button>
            <button
              onClick={confirm}
              className="bg-maroon text-cream min-h-11 font-semibold"
            >
              {ask.kind === "reset" ? "Replace" : "Remove"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * The item's picture, doubling as the button to change it. Tapping opens the
 * iPad's photo picker (or camera); the photo is shrunk to the register tile and
 * saved to the cloud before the item points at it.
 */
function PhotoButton({
  item,
  onChange,
}: {
  item: CatalogItem;
  onChange: (src: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  return (
    <div className="shrink-0">
      <label
        title={err || "Add or change the photo"}
        className={`border-maroon/25 bg-petal/50 relative grid size-14 cursor-pointer place-items-center overflow-hidden border text-xs ${err ? "border-maroon" : ""}`}
      >
        {item.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt="" className="size-full object-contain" />
        ) : (
          <span className="text-maroon/60">{busy ? "…" : "+ Photo"}</span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={`Photo of ${item.name}`}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setErr("");
            try {
              onChange(await uploadItemPhoto(item.id, file));
              toast.success(`Photo added to ${item.name}.`);
            } catch (x) {
              const message =
                x instanceof Error ? x.message : "Couldn’t add the photo.";
              setErr(message);
              toast.error(message);
            }
            setBusy(false);
          }}
        />
      </label>
      {item.src?.startsWith("/api/") && (
        <button
          onClick={() => {
            void deleteItemPhoto(item.id);
            onChange(undefined);
            toast.info(`Photo removed from ${item.name}.`);
          }}
          className="text-ink/50 mt-0.5 block w-full text-center text-[11px] underline"
        >
          Remove
        </button>
      )}
      {err && (
        <span
          role="alert"
          className="text-maroon block w-14 text-[11px] leading-tight"
        >
          {err}
        </span>
      )}
    </div>
  );
}
