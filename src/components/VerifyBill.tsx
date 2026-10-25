"use client";

import { useState } from "react";
import { inr } from "@/lib/money";
import { prettyDate, prettyTime } from "@/lib/time";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import { useToast } from "./Toasts";

/**
 * Staff check of a receipt someone is holding: the bill number and the code
 * printed under it. If both match the record, the record is shown, so the
 * amount and items can be compared with the paper in front of you — the code
 * proves the bill exists, and the comparison catches an edited picture.
 */
type Outcome =
  | { kind: "genuine"; sale: Sale }
  | { kind: "no" }
  | { kind: "error"; message: string };

export default function VerifyBill({ onClose }: { onClose: () => void }) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  const toast = useToast();

  async function check() {
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceNo, code }),
      });
      if (!res.ok) {
        const message =
          res.status === 401
            ? "Signed out — sign in again."
            : "Couldn’t check just now.";
        setOut({ kind: "error", message });
        toast.error(message);
      } else {
        const body = (await res.json()) as { genuine: boolean; sale?: Sale };
        if (body.genuine && body.sale) {
          setOut({ kind: "genuine", sale: body.sale });
          toast.success("Genuine receipt: it matches our records.");
        } else {
          setOut({ kind: "no" });
          toast.error("No bill matches that number and code.");
        }
      }
    } catch {
      setOut({ kind: "error", message: "No connection." });
      toast.error("No connection.");
    }
    setBusy(false);
  }

  const field =
    "border-maroon/30 bg-white/70 min-h-12 w-full border px-3 text-base tracking-wide uppercase";

  return (
    <Modal title="Verify a receipt" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
        className="space-y-3"
      >
        <label className="block text-xs tracking-[0.14em] uppercase">
          Bill number
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="JT-24102026-203015-0007"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${field} mt-1`}
          />
        </label>
        <label className="block text-xs tracking-[0.14em] uppercase">
          Verify code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-2345"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${field} mt-1`}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !invoiceNo.trim() || !code.trim()}
          className="bg-maroon text-cream min-h-12 w-full px-4 text-sm font-semibold tracking-wide disabled:opacity-45"
        >
          {busy ? "Checking…" : "Check"}
        </button>
      </form>

      <div className="mt-4" aria-live="polite">
        {out?.kind === "genuine" && (
          <div className="border-olive/40 bg-olive/10 space-y-1 border p-3 text-sm">
            <p className="text-olive font-semibold">✓ Matches our records</p>
            <p className="font-display text-maroon text-2xl">
              {inr(out.sale.total)}{" "}
              <span className="text-ink/60 text-sm">
                by {out.sale.paymentMode}
              </span>
            </p>
            <p className="text-ink/70">
              {prettyDate(out.sale.createdAt)}, {prettyTime(out.sale.createdAt)}
            </p>
            <ul className="text-ink/80 list-disc pl-5">
              {out.sale.lines.map((l) => (
                <li key={l.key}>
                  {l.qty} × {l.name}
                </li>
              ))}
            </ul>
            <p className="text-ink/60 text-xs">
              Compare the amount and items with the receipt you were shown.
            </p>
          </div>
        )}
        {out?.kind === "no" && (
          <p role="alert" className="text-maroon text-sm">
            ✗ No bill matches that number and code. Check for typing slips; if
            it’s right, this receipt is not from us.
          </p>
        )}
        {out?.kind === "error" && (
          <p role="alert" className="text-maroon text-sm">
            {out.message}
          </p>
        )}
      </div>
    </Modal>
  );
}
