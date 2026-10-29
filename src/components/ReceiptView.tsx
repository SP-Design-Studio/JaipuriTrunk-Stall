"use client";

import { useEffect, useState } from "react";
import { sendReviewEvent } from "@/lib/reviewEvents";
import type { Sale } from "@/lib/types";
import Receipt from "./Receipt";
import ReviewForm from "./ReviewForm";
import { useReceiptFiles } from "./useReceiptFiles";

/**
 * The customer's own receipt, opened from the link they were sent. Same picture
 * as the one at the stall, with buttons to keep it. Nothing is stored on their
 * phone unless they choose to download.
 */
/** How long "Skip for now" is remembered on the customer's own phone. */
const SKIP_DAYS = 3;
const skipKey = (token: string) => `jts-review-skip:${token}`;

export default function ReceiptView({
  sale,
  token,
  askReview,
}: {
  sale: Sale;
  /** The receipt link's token, which the review is sent with. */
  token: string;
  /** True when this bill has no review yet (and reviews can be read at all). */
  askReview: boolean;
}) {
  const { ref, named, failed } = useReceiptFiles(sale);
  const [note, setNote] = useState("");
  // The review comes first. The bill is already on the page underneath (the
  // PNG and PDF are made from it), covered until the customer sends or skips.
  const [asking, setAsking] = useState(askReview);

  // Someone who skipped recently isn't nagged again on this phone. Only the
  // customer's own browser is used, and only to remember that one tap.
  useEffect(() => {
    if (!askReview) return;
    const t = window.setTimeout(() => {
      try {
        const at = Number(localStorage.getItem(skipKey(token)));
        if (at && Date.now() - at < SKIP_DAYS * 86_400_000) {
          setAsking(false);
          return;
        }
        // They are being asked: note it, so staff can tell who has seen the prompt.
        sendReviewEvent(token, "asked");
      } catch {
        // Storage blocked: they simply get asked.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [askReview, token]);

  function skip() {
    sendReviewEvent(token, "skipped");
    try {
      localStorage.setItem(skipKey(token), String(Date.now()));
    } catch {
      // Not remembered; fine.
    }
    setAsking(false);
  }

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
    <main className="bg-petal/60 flex min-h-dvh flex-col items-center px-0 py-6 min-[400px]:px-4 sm:py-8">
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
      {asking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review your purchase"
          className="bg-cream fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto"
        >
          <ReviewForm
            token={token}
            onSubmitted={() => {
              setAsking(false);
              setNote("Thank you for your review!");
            }}
            onSkip={skip}
          />
        </div>
      )}
    </main>
  );
}
