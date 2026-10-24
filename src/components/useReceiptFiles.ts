"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jpegToPdf } from "@/lib/pdf";
import type { Sale } from "@/lib/types";

/**
 * Draws the receipt (the element `ref` is attached to) into a PNG and a one-page
 * PDF, once, as soon as it is on screen. Shared by the till's receipt sheet and
 * the customer's own receipt page, so the two files are identical.
 */
type Files = { png: Blob; pdf: Blob };

export function useReceiptFiles(sale: Sale) {
  const ref = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Files | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Webfonts must be in before the capture or the receipt is set in Times.
      await document.fonts?.ready;
      const html2canvas = (await import("html2canvas")).default;
      if (cancelled || !ref.current) return;
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#fdf6ea",
        logging: false,
      });
      const toBlob = (type: string, quality?: number) =>
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("encode failed"))),
            type,
            quality,
          ),
        );
      const [png, jpeg] = await Promise.all([
        toBlob("image/png"),
        toBlob("image/jpeg", 0.92),
      ]);
      const pdf = jpegToPdf(
        new Uint8Array(await jpeg.arrayBuffer()),
        canvas.width,
        canvas.height,
        sale.invoiceNo,
      );
      if (!cancelled) setFiles({ png, pdf });
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [sale.id, sale.invoiceNo]);

  const named = useMemo(
    () =>
      files && {
        png: new File([files.png], `${sale.invoiceNo}.png`, {
          type: "image/png",
        }),
        pdf: new File([files.pdf], `${sale.invoiceNo}.pdf`, {
          type: "application/pdf",
        }),
      },
    [files, sale.invoiceNo],
  );

  return { ref, named, failed };
}
