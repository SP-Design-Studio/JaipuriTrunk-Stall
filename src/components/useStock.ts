"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./Toasts";

/**
 * Stock per item, read from the database and held in memory only. `stock` is
 * null until the first answer (or if stock can't be read at all, e.g. the
 * migration hasn't been run); the till then simply doesn't show or enforce it.
 *
 * An item with no entry isn't counted. The server lowers counts when a bill is
 * saved, so after each sale the till refreshes rather than doing the sum itself.
 */
export function useStock() {
  const toast = useToast();
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/stock", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { stock: Record<string, number> };
      if (alive.current) setStock(body.stock);
    } catch {
      // Keeps what it had; the next refresh tries again.
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const first = window.setTimeout(() => void refresh(), 0);
    const onVisible = () =>
      document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      alive.current = false;
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  /** Sets an item's count, or stops counting it with null. */
  const set = useCallback(
    async (itemId: string, quantity: number | null) => {
      const before = stock;
      // Show it at once; put it back if the save fails.
      setStock((cur) => {
        const next = { ...cur };
        if (quantity === null) delete next[itemId];
        else next[itemId] = quantity;
        return next;
      });
      try {
        const res = await fetch("/api/stock", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemId, quantity }),
        });
        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(error ?? "Couldn’t save the stock.");
        }
      } catch (e) {
        setStock(before);
        toast.error(
          e instanceof Error ? e.message : "Couldn’t save the stock.",
        );
      }
    },
    [stock, toast],
  );

  return { stock, refresh, set };
}
