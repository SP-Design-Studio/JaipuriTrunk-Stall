"use client";

import { deleteItemPhoto, uploadItemPhoto } from "./photo";
import { useState } from "react";
import {
  LIMITS,
  defaultCatalog,
  newId,
  type Catalog,
  type CatalogItem,
  type CatalogCategory,
} from "@/lib/catalog";
import { TEST_PRICES } from "@/lib/testPrices";
import Modal from "./Modal";
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

type Ask =
  | { kind: "category"; id: string }
  | { kind: "item"; catId: string; itemId: string }
  | { kind: "reset" };

export default function ManageItems({
  catalog,
  status,
  onChange,
  onRetry,
}: {
  catalog: Catalog;
  status: SaveState;
  onChange: (next: Catalog) => void;
  onRetry: () => void;
}) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const toast = useToast();

  const total = catalog.categories.reduce((n, c) => n + c.items.length, 0);

  const patchCategory = (id: string, patch: Partial<CatalogCategory>) =>
    onChange({
      categories: catalog.categories.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });

  const patchItem = (
    catId: string,
    itemId: string,
    patch: { name?: string; price?: number | null; src?: string },
  ) =>
    onChange({
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
  }

  function addItem() {
    const label = name.trim();
    if (!addingTo || !label) return;
    const p = Number(price);
    patchCategory(addingTo, {
      items: [
        ...(catalog.categories.find((c) => c.id === addingTo)?.items ?? []),
        {
          id: newId(),
          name: label,
          price: Number.isInteger(p) && p > 0 ? p : null,
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
        categories: catalog.categories.filter((c) => c.id !== ask.id),
      });
      toast.info("Category removed.");
    } else {
      // A removed item's uploaded photo goes with it.
      void deleteItemPhoto(ask.itemId);
      onChange({
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
            Prices left empty are asked for at the till. A category with sizes
            or colours asks for them when an item is tapped. Removing something
            only changes what the register offers; past receipts keep what they
            sold for.
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
                <div>
                  <label className={label} htmlFor={`s-${c.id}`}>
                    Sizes (optional)
                  </label>
                  <Field
                    id={`s-${c.id}`}
                    key={`s:${c.sizes.join("|")}`}
                    value={c.sizes.join(", ")}
                    placeholder="UK 5, UK 6, UK 7"
                    onCommit={(v) =>
                      patchCategory(c.id, {
                        sizes: labelsOf(v, LIMITS.size, LIMITS.sizes),
                      })
                    }
                    className={box}
                  />
                </div>
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
                  <button
                    onClick={() =>
                      setAsk({ kind: "item", catId: c.id, itemId: i.id })
                    }
                    aria-label={`Remove ${i.name}`}
                    className={danger}
                  >
                    ×
                  </button>
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
