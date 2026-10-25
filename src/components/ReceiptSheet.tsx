"use client";

import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/config";
import { receiptText, waLink, waWebLink, type Templates } from "@/lib/messages";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import { useToast } from "./Toasts";
import Receipt from "./Receipt";
import { useReceiptFiles } from "./useReceiptFiles";

/**
 * The receipt on screen, as an image and as a PDF, and the ways to send either.
 *
 * Both files are made as soon as the sheet opens and held in memory, because
 * iPad Safari only lets `navigator.share` run directly inside the tap that
 * called it: an `await` before it (to render the file, say) uses up the user
 * activation and the share sheet silently refuses to open. A button that was
 * pressed and did nothing is the worst thing a till can do at a busy stall, so
 * the buttons stay disabled until the files exist.
 *
 * Sent through the share sheet, WhatsApp receives the PNG as a photo and the PDF
 * as a document. A WhatsApp *link* cannot carry either — that is a limit of the
 * link, not of this app — so "Open WhatsApp chat" sends text, and the text
 * carries the customer's own receipt link, where they can view and download it
 * whenever they like.
 */
export default function ReceiptSheet({
  sale,
  fresh,
  templates,
  onClose,
}: {
  sale: Sale;
  templates: Templates | null;
  /** True straight after a sale, so the close button reads "Next customer". */
  fresh: boolean;
  onClose: () => void;
}) {
  const { ref, named, failed } = useReceiptFiles(sale);
  const toastOnce = useToast();
  const [note, setNote] = useState("");
  const toast = toastOnce;
  useEffect(() => {
    if (failed)
      toast.error("Couldn’t make the receipt files. The sale is saved.");
  }, [failed, toast]);
  // Can this device share files at all? (iPad/iPhone yes; most desktops no.)
  const [canShareFiles] = useState(
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File(["x"], "r.png", { type: "image/png" })],
      }),
  );
  // The link is relative on the server. Customers get the public address if one
  // is set (NEXT_PUBLIC_RECEIPT_BASE_URL, e.g. https://stall.jaipuritrunk.com),
  // whatever address the till itself was opened on; otherwise the till's own.
  const base = (
    process.env.NEXT_PUBLIC_RECEIPT_BASE_URL || window.location.origin
  ).replace(/\/+$/, "");
  const link = sale.receiptPath ? `${base}${sale.receiptPath}` : undefined;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
      toast.success("Receipt link copied.");
    } catch {
      setNote(link);
    }
  }

  function save(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked late: Safari starts the download after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNote(`Saved ${file.name} to Files.`);
    toast.success(`Saved ${file.name}.`);
  }

  function share(file: File | undefined) {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      navigator
        .share({
          files: [file],
          title: `${BUSINESS.name} receipt`,
          text: receiptText(sale, link, templates),
        })
        .catch(() => {
          // Dismissing the sheet rejects with AbortError. Not an error.
        });
    } else {
      // No share sheet (a desktop browser): the next best thing is the file.
      save(file);
    }
  }

  const ready = Boolean(named);
  const btn =
    "inline-flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold tracking-wide transition-colors disabled:opacity-45";
  const outline = `${btn} border-maroon/30 text-maroon border hover:bg-petal`;

  return (
    <Modal
      title={fresh ? "Sale saved" : sale.invoiceNo}
      onClose={onClose}
      large
    >
      <div className="grid gap-4 md:grid-cols-[384px_1fr]">
        <div
          className="max-h-[38dvh] overflow-y-auto bg-petal/60 p-3 md:max-h-[72dvh]"
          data-files-ready={ready}
        >
          <div className="mx-auto w-[360px] max-w-full">
            <Receipt ref={ref} sale={sale} />
          </div>
        </div>

        <div className="space-y-2 md:self-start">
          {failed && (
            <p role="alert" className="text-maroon text-sm">
              Couldn’t make the receipt files. The sale is saved; close this and
              open it again from Sales.
            </p>
          )}
          <p className="text-olive/80 text-xs tracking-[0.18em] uppercase">
            Send the receipt
          </p>
          {/* Where the device can share files (an iPad or phone), one Share button
              per file: its share sheet already has Save to Files and Print. Where it
              can't (a desktop browser), Share would only download, so the buttons
              say Download instead. */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Image (PNG)", "png"],
                ["PDF", "pdf"],
              ] as const
            ).map(([label, kind]) => (
              <button
                key={kind}
                onClick={() => share(named?.[kind])}
                disabled={!ready}
                className={`${btn} bg-maroon text-cream hover:bg-maroon-deep`}
              >
                {!ready
                  ? "Preparing…"
                  : canShareFiles
                    ? `Share ${label}`
                    : `Download ${label}`}
              </button>
            ))}
          </div>
          {canShareFiles && (
            <p className="text-ink/50 text-xs">
              To keep a copy or print it, choose Save to Files or Print in the
              share sheet.
            </p>
          )}

          {!link && (
            <p role="alert" className="text-maroon text-sm">
              No receipt link: RECEIPT_SECRET isn’t set on this server. Add it
              (32+ random characters) to the environment, restart or redeploy,
              and new receipts will carry the link.
            </p>
          )}
          {sale.customerPhone && (
            <a
              href={waLink(
                sale.customerPhone,
                receiptText(sale, link, templates),
              )}
              className={`${btn} border-olive/40 text-olive hover:bg-olive/10 border`}
            >
              Open WhatsApp (sends the receipt link)
            </a>
          )}
          {sale.customerPhone && (
            <a
              href={waWebLink(
                sale.customerPhone,
                receiptText(sale, link, templates),
              )}
              target="_blank"
              rel="noreferrer"
              className="text-ink/60 hover:text-ink block text-center text-xs underline"
            >
              WhatsApp app not opening? Use the web link
            </a>
          )}
          {link && (
            <button onClick={copyLink} className={outline}>
              Copy receipt link
            </button>
          )}
          <button
            onClick={onClose}
            className={`${btn} text-ink/70 hover:text-ink`}
          >
            {fresh ? "Next customer" : "Close"}
          </button>
          <p className="text-ink/50 min-h-5 text-center text-xs">
            {note || "Saved to the cloud."}
          </p>
        </div>
      </div>
    </Modal>
  );
}
