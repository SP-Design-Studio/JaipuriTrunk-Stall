"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./Toasts";

/**
 * The UPI QR, read from the database and held in memory only. `image` is
 * undefined until the first answer, null when none has been uploaded.
 */
const MAX_SIDE = 800;
const MAX_BYTES = 300_000;

/** Shrinks a photo or screenshot of a QR to something small enough to store. */
async function prepare(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That isn’t a picture.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t read that picture.");
  // White behind transparent PNGs, or the QR turns black-on-black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = canvas.toDataURL("image/png");
  if (url.length > MAX_BYTES) url = canvas.toDataURL("image/jpeg", 0.88);
  if (url.length > MAX_BYTES) throw new Error("That picture is too large.");
  return url;
}

export function useUpiQr() {
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    const first = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/upi-qr", { cache: "no-store" });
        if (res.ok)
          setImage(((await res.json()) as { image: string | null }).image);
      } catch {
        // Stays undefined: the till still works, it just can't show the QR yet.
      }
    }, 0);
    return () => window.clearTimeout(first);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setError("");
      try {
        const url = await prepare(file);
        const res = await fetch("/api/upi-qr", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: url }),
        });
        if (!res.ok) {
          const { error: e } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(e ?? "Couldn’t save the QR.");
        }
        setImage(url);
        toast.success("UPI QR saved.");
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Couldn’t save the QR.";
        setError(message);
        toast.error(message);
      }
    },
    [toast],
  );

  const remove = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/upi-qr", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setImage(null);
      toast.info("UPI QR removed.");
    } catch {
      setError("Couldn’t remove the QR.");
      toast.error("Couldn’t remove the QR.");
    }
  }, [toast]);

  return { image, error, upload, remove };
}
