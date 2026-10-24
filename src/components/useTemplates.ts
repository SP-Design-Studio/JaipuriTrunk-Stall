"use client";

import { useCallback, useEffect, useState } from "react";
import type { Templates } from "@/lib/messages";

/** The saved WhatsApp wording, from the database, held in memory only. null = defaults. */
export function useTemplates() {
  const [saved, setSaved] = useState<Templates | null>(null);

  useEffect(() => {
    const first = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/wa-templates", { cache: "no-store" });
        if (res.ok)
          setSaved(
            ((await res.json()) as { templates: Templates | null }).templates,
          );
      } catch {
        // Defaults apply until it loads.
      }
    }, 0);
    return () => window.clearTimeout(first);
  }, []);

  const save = useCallback(async (next: Templates): Promise<string | null> => {
    try {
      const res = await fetch("/api/wa-templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        return error ?? "Couldn’t save.";
      }
      setSaved(next);
      return null;
    } catch {
      return "No connection.";
    }
  }, []);

  const reset = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/wa-templates", { method: "DELETE" });
      if (!res.ok) return "Couldn’t reset.";
      setSaved(null);
      return null;
    } catch {
      return "No connection.";
    }
  }, []);

  return { saved, save, reset };
}
