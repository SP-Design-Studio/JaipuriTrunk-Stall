"use client";

import { useCallback, useEffect, useState } from "react";
import type { StallEntry } from "@/lib/types";

/**
 * The stalls (monthly events) and which one is current, from the database, held
 * in memory only. `stalls` is null until the first answer, then a possibly empty
 * list; every sale made while a stall is current is recorded against it.
 */
export function useStalls() {
  const [stalls, setStalls] = useState<StallEntry[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const first = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/stalls", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as {
            stalls: StallEntry[];
            currentId: string | null;
          };
          setStalls(body.stalls);
          setCurrentId(body.currentId);
        }
      } catch {
        // Stays null: the till opens without stall names rather than not at all.
      }
    }, 0);
    return () => window.clearTimeout(first);
  }, []);

  const save = useCallback(
    async (
      next: StallEntry[],
      nextCurrent: string | null,
    ): Promise<string | null> => {
      try {
        const res = await fetch("/api/stalls", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stalls: next, currentId: nextCurrent }),
        });
        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          return error ?? "Couldn’t save.";
        }
        setStalls(next);
        setCurrentId(nextCurrent);
        return null;
      } catch {
        return "No connection.";
      }
    },
    [],
  );

  return { stalls, currentId, save };
}
