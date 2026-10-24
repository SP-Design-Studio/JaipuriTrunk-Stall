"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sale } from "@/lib/types";

/**
 * Sales live in the database and nowhere else. This hook holds what is on screen
 * and nothing more: no outbox, no cache, no localStorage. Close the tab and the
 * browser keeps nothing, which is the point — customer phone numbers are not
 * left on a tablet that sits on a market stall.
 *
 * The price of that is that a sale is only real once the server says so. `save`
 * therefore reports the outcome plainly, and the till does not show a receipt
 * for a sale that did not land.
 */
export type Connection = "unknown" | "ok" | "down" | "signedOut" | "notSetUp";

export type SaveResult =
  /** `sale` is the stored copy, which carries the bill number the server gave it. */
  | { status: "saved"; sale: Sale }
  | {
      status: "failed";
      message: string;
      /** The request may have reached the server before the connection died. */
      maybeSaved: boolean;
    };

/** Keys an earlier version of the till wrote to the iPad. Removed on sight. */
const LEGACY = [
  "jts-outbox-v1",
  "jts-cache-v1",
  "jts-catalog-v1",
  "jts-catalog-dirty-v1",
];

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [conn, setConn] = useState<Connection>("unknown");

  /** Returns the list it fetched, or null if it could not. */
  const refresh = useCallback(async (): Promise<Sale[] | null> => {
    try {
      const res = await fetch("/api/sales", { cache: "no-store" });
      if (res.status === 401) {
        setConn("signedOut");
        return null;
      }
      if (res.status === 503) {
        setConn("notSetUp");
        return null;
      }
      if (!res.ok) {
        setConn("down");
        return null;
      }
      const list = ((await res.json()) as { sales: Sale[] }).sales;
      setSales(list);
      setConn("ok");
      return list;
    } catch {
      setConn("down");
      return null;
    }
  }, []);

  const save = useCallback(async (sale: Sale): Promise<SaveResult> => {
    let res: Response;
    try {
      res = await fetch("/api/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sale),
      });
    } catch {
      setConn("down");
      return { status: "failed", message: "No connection.", maybeSaved: true };
    }

    if (res.ok) {
      setConn("ok");
      const { sale: stored } = (await res.json()) as { sale: Sale };
      setSales((cur) => [stored, ...cur.filter((s) => s.id !== stored.id)]);
      return { status: "saved", sale: stored };
    }

    const { error } = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    if (res.status === 401) {
      setConn("signedOut");
      return {
        status: "failed",
        message: "You have been signed out.",
        maybeSaved: false,
      };
    }
    if (res.status === 503) {
      setConn("notSetUp");
      return {
        status: "failed",
        message: "Cloud storage isn’t set up.",
        maybeSaved: false,
      };
    }
    if (res.status === 409) {
      return {
        status: "failed",
        message: error ?? "Couldn’t number the bill.",
        maybeSaved: false,
      };
    }
    // 5xx: the server may have written the row before it failed to answer.
    return {
      status: "failed",
      message: error ?? "The cloud didn’t accept it.",
      maybeSaved: res.status >= 500,
    };
  }, []);

  useEffect(() => {
    try {
      LEGACY.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Storage blocked: nothing to clear.
    }
    // Next tick, from a timer callback — see the note in useCatalog.
    const first = window.setTimeout(() => void refresh(), 0);
    const onVisible = () =>
      document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { sales, conn, refresh, save };
}
