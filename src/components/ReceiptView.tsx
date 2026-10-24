"use client";

import { useState } from "react";
import type { Sale } from "@/lib/types";
import Receipt from "./Receipt";
import { useReceiptFiles } from "./useReceiptFiles";

/**
 * The customer's own receipt, opened from the link they were sent. Same picture
 * as the one at the stall, with buttons to keep it. Nothing is stored on their
 * phone unless they choose to download.
 */
export default function ReceiptView({ sale }: { sale: Sale }) {
  const { ref, named, failed } = useReceiptFiles(sale);
  const [note, setNote] = useState("");

  function save(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNote(`Saved ${file.name}.`);
  }

  const btn =
    "inline-flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold tracking-wide disabled:opacity-45";

  return (
    <main className="bg-petal/60 flex min-h-dvh flex-col items-center px-4 py-8">
      <div className="w-[360px] max-w-full">
        <Receipt ref={ref} sale={sale} showCustomer={false} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => save(named?.png)}
            disabled={!named}
            className={`${btn} bg-maroon text-cream`}
          >
            {named ? "Download image" : "Preparing…"}
          </button>
          <button
            onClick={() => save(named?.pdf)}
            disabled={!named}
            className={`${btn} bg-maroon text-cream`}
          >
            {named ? "Download PDF" : "Preparing…"}
          </button>
        </div>
        {failed && (
          <p className="text-maroon mt-3 text-center text-sm">
            Couldn’t prepare the download. You can still read the receipt above.
          </p>
        )}
        <p className="text-ink/50 mt-3 min-h-5 text-center text-xs">
          {note || "This page stays available at this link."}
        </p>
      </div>
    </main>
  );
}
