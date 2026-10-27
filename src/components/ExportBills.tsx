"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { imagesToPdf } from "@/lib/pdf";
import { inr } from "@/lib/money";
import { todayKey } from "@/lib/time";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import { useToast } from "./Toasts";
import Receipt from "./Receipt";

/**
 * Every bill in the current list, as one PDF and as PNG pages, for book-keeping
 * or for printing. Each bill gets an A4 page of its own, oldest first,
 * each one exactly as the customer's copy (with its bill number and verify code).
 *
 * The receipts are drawn off-screen, photographed one at a time (so a long
 * list doesn't freeze the iPad), and packed onto pages. Nothing is kept on the
 * iPad: the files exist in memory until the sheet is closed. A cap keeps the
 * work and the page count sensible; narrow the list (Today) for bigger days.
 */
const MAX = 100;
const PAGE_W = 1240; // A4 at 150 dpi
const PAGE_H = 1754;
const MARGIN = 40;
const TOP = 90; // room for the heading

type Page = { png: Blob; jpeg: Uint8Array };

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), type, q),
  );

export default function ExportBills({
  sales,
  label,
  onClose,
}: {
  sales: Sale[];
  label: string;
  onClose: () => void;
}) {
  const bills = useMemo(
    () =>
      [...sales]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-MAX),
    [sales],
  );
  const capped = sales.length > MAX;
  const total = bills.reduce((n, s) => n + s.total, 0);

  const [phase, setPhase] = useState<"idle" | "working" | "done" | "failed">(
    "idle",
  );
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);
  const [note, setNote] = useState("");
  const toast = useToast();
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "working") return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      const html2canvas = (await import("html2canvas")).default;
      const els = Array.from(holder.current?.children ?? []) as HTMLElement[];
      const shots: HTMLCanvasElement[] = [];
      for (const el of els) {
        if (cancelled) return;
        shots.push(
          await html2canvas(el, {
            scale: 2,
            // Transparent, so the torn edges stay clear; the page sheet below is white.
            backgroundColor: null,
            logging: false,
          }),
        );
        setProgress(shots.length);
      }

      // One bill per A4 page, centred, at the size it was drawn (scaled down
      // only if a very long bill would not fit).
      const out: Page[] = [];
      for (const [i, shot] of shots.entries()) {
        const sheet = document.createElement("canvas");
        sheet.width = PAGE_W;
        sheet.height = PAGE_H;
        const g = sheet.getContext("2d");
        if (!g) throw new Error("no canvas");
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, PAGE_W, PAGE_H);
        const fit = Math.min(1, (PAGE_H - TOP - MARGIN) / shot.height);
        const w = shot.width * fit;
        g.drawImage(shot, (PAGE_W - w) / 2, TOP, w, shot.height * fit);
        g.fillStyle = "#5b4a4d";
        g.font = "20px sans-serif";
        g.fillText(`JaipuriTrunk · ${label}`, MARGIN, 44);
        g.textAlign = "right";
        g.fillText(`Bill ${i + 1} of ${shots.length}`, PAGE_W - MARGIN, 44);
        const [png, jpeg] = await Promise.all([
          toBlob(sheet, "image/png"),
          toBlob(sheet, "image/jpeg", 0.9),
        ]);
        out.push({ png, jpeg: new Uint8Array(await jpeg.arrayBuffer()) });
      }
      if (!cancelled) {
        setPages(out);
        setPhase("done");
        toast.success(
          `Ready: ${out.length} page${out.length === 1 ? "" : "s"}.`,
        );
      }
    })().catch(() => {
      if (cancelled) return;
      setPhase("failed");
      toast.error("Couldn’t make the bill files. Try a shorter list.");
    });
    return () => {
      cancelled = true;
    };
  }, [phase, bills, label, total, toast]);

  const stem = `JaipuriTrunk-bills-${todayKey()}`;
  const files = useMemo(() => {
    if (pages.length === 0) return null;
    const pdf = imagesToPdf(
      pages.map((p) => ({
        jpeg: p.jpeg,
        widthPx: PAGE_W,
        heightPx: PAGE_H,
        pageW: 595.28,
        pageH: 841.89,
      })),
      `${stem}`,
    );
    return {
      pdf: [new File([pdf], `${stem}.pdf`, { type: "application/pdf" })],
      png: pages.map(
        (p, i) =>
          new File([p.png], `${stem}-p${i + 1}.png`, { type: "image/png" }),
      ),
    };
  }, [pages, stem]);

  function save(list: File[]) {
    list.forEach((file, i) =>
      setTimeout(() => {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }, i * 400),
    );
    setNote(`Saved ${list.length} file${list.length > 1 ? "s" : ""}.`);
    toast.success(`Saved ${list.length} file${list.length > 1 ? "s" : ""}.`);
  }

  function send(list: File[]) {
    if (navigator.canShare?.({ files: list })) {
      navigator.share({ files: list, title: stem }).catch(() => {
        // Dismissing the sheet rejects; not an error.
      });
    } else {
      save(list);
    }
  }

  const btn =
    "inline-flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold tracking-wide disabled:opacity-45";

  return (
    <Modal title="All bills — print or keep" onClose={onClose} wide>
      <p className="text-ink/70 text-sm">
        {bills.length === 0
          ? "There are no bills in this list."
          : `${bills.length} bills from “${label}”, ${inr(total)} in all, one bill per A4 page — a PDF for printing and filing, and PNG pages.`}
      </p>
      {capped && (
        <p className="text-maroon mt-2 text-sm">
          Only the latest {MAX} bills are included. Pick “Today” for a smaller
          list.
        </p>
      )}

      <div className="mt-4 space-y-2" aria-live="polite">
        {phase === "idle" && (
          <button
            onClick={() => setPhase("working")}
            disabled={bills.length === 0}
            className={`${btn} bg-maroon text-cream`}
          >
            Prepare files
          </button>
        )}
        {phase === "working" && (
          <p className="text-ink/70 text-center text-sm">
            Drawing bill {Math.min(progress + 1, bills.length)} of{" "}
            {bills.length}…
          </p>
        )}
        {phase === "failed" && (
          <p role="alert" className="text-maroon text-sm">
            Couldn’t make the files. Try a shorter list (Today).
          </p>
        )}
        {phase === "done" && files && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => send(files.pdf)}
                className={`${btn} bg-maroon text-cream`}
              >
                PDF · {pages.length} page{pages.length > 1 ? "s" : ""}
              </button>
              <button
                onClick={() => send(files.png)}
                className={`${btn} bg-maroon text-cream`}
              >
                PNG · {pages.length} page{pages.length > 1 ? "s" : ""}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => save(files.pdf)}
                className={`${btn} border-maroon/30 text-maroon border`}
              >
                Save PDF
              </button>
              <button
                onClick={() => save(files.png)}
                className={`${btn} border-maroon/30 text-maroon border`}
              >
                Save PNG
              </button>
            </div>
            <p className="text-ink/50 text-center text-xs">
              To print: open the PDF and use Share → Print.
            </p>
          </>
        )}
        <p className="text-ink/50 min-h-5 text-center text-xs">{note}</p>
      </div>

      {phase === "working" && (
        <div
          ref={holder}
          aria-hidden
          style={{ position: "fixed", left: -10000, top: 0 }}
        >
          {bills.map((s) => (
            <Receipt key={s.id} sale={s} />
          ))}
        </div>
      )}
    </Modal>
  );
}
