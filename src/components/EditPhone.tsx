"use client";

import { useState } from "react";
import { PHONE_HINT, normalizePhone } from "@/lib/phone";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import { useToast } from "./Toasts";

/**
 * Corrects the customer's phone number on a bill. Only the number changes, never
 * the money or the items. If other bills carry the same number it offers to fix
 * those too, since a customer's repeat purchases usually share the same slip.
 */
export default function EditPhone({
  sale,
  sharedWith,
  onSaved,
  onClose,
}: {
  sale: Sale;
  /** How many OTHER bills carry the same number as this one. */
  sharedWith: number;
  onSaved: (updated: Sale[]) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState(sale.customerPhone);
  const [also, setAlso] = useState(sharedWith > 0);
  const [busy, setBusy] = useState(false);

  const normal = phone.trim() === "" ? "" : normalizePhone(phone);
  const needsNumber = normal === "" && sale.marketingOk;
  const unchanged = normal === sale.customerPhone;
  const problem =
    normal === null
      ? "Not a valid number yet."
      : needsNumber
        ? "They agreed to be messaged, so the bill needs a number."
        : "";

  async function save() {
    if (normal === null || needsNumber || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          phone,
          alsoSameNumber: also && sharedWith > 0,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        sales?: Sale[];
        error?: string;
      };
      if (!res.ok || !body.sales) {
        toast.error(body.error ?? "Couldn’t save the number.");
        setBusy(false);
        return;
      }
      const n = body.sales.length;
      toast.success(
        n > 1
          ? `Number updated on ${n} bills.`
          : normal === ""
            ? "Number removed."
            : "Number updated.",
      );
      onSaved(body.sales);
    } catch {
      toast.error("No connection. The number wasn’t changed.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={sale.customerPhone ? "Edit number" : "Add number"}
      onClose={onClose}
      wide
    >
      <p className="text-ink/60 text-sm">
        {sale.customerName || "Walk-in"} · {sale.invoiceNo}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mt-3 space-y-3"
      >
        <label className="block text-xs tracking-[0.14em] uppercase">
          WhatsApp number
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/[^\d+\s\-().]/g, "").slice(0, 22),
              )
            }
            placeholder="98765 43210 or +1 415 555 2671"
            autoFocus
            autoComplete="off"
            className="border-maroon/30 bg-white/70 mt-1 min-h-12 w-full border px-3 text-base normal-case tracking-normal"
          />
        </label>
        <p
          className={`text-xs ${problem ? "text-amber-700" : "text-ink/55"}`}
          aria-live="polite"
        >
          {problem ||
            (normal
              ? normal.startsWith("+")
                ? `International · ${normal}`
                : `India · +91 ${normal}`
              : "No number")}
        </p>
        <p className="text-ink/45 text-xs">{PHONE_HINT}.</p>

        {sharedWith > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={also}
              onChange={(e) => setAlso(e.target.checked)}
              className="mt-0.5 size-6 shrink-0"
            />
            <span>
              Also fix the {sharedWith} other bill{sharedWith === 1 ? "" : "s"}{" "}
              with the same number ({sale.customerPhone}).
            </span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="border-maroon/30 text-maroon min-h-12 border px-4 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !!problem || unchanged}
            className="bg-maroon text-cream min-h-12 px-4 text-sm font-semibold disabled:opacity-45"
          >
            {busy ? "Saving…" : "Save number"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
