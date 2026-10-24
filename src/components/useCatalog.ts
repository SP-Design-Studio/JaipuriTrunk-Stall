"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultCatalog, normalize, type Catalog } from "@/lib/catalog";

/**
 * The item list, read from the database on opening and written back as it is
 * edited. Like sales, it is held in memory only: there is no copy on the iPad.
 *
 * `catalog` is null until the first answer arrives, and the till does not open
 * without one — with no way to save a sale it would be a till you can only look
 * at. Edits are saved shortly after the last keystroke; if that fails the status
 * says so and stays until a save lands, and closing the tab warns, because the
 * edit exists nowhere else.
 *
 * Conflicts are last-write-wins. One person edits this list, on one iPad.
 */
export type CatalogPhase =
  "loading" | "ready" | "unreachable" | "signedOut" | "notSetUp";
export type SaveState =
  { kind: "saved" } | { kind: "saving" } | { kind: "failed"; message: string };

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [phase, setPhase] = useState<CatalogPhase>("loading");
  const [save, setSave] = useState<SaveState>({ kind: "saved" });
  const latest = useRef<Catalog | null>(null);
  const timer = useRef<number | null>(null);
  const version = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      if (res.status === 401) return setPhase("signedOut");
      if (res.status === 503) return setPhase("notSetUp");
      if (!res.ok) return setPhase("unreachable");
      const { catalog: remote } = (await res.json()) as {
        catalog: Catalog | null;
      };
      // Nothing saved yet: start from the starter list, held in memory. It is
      // written to the database the first time someone changes something.
      const list =
        remote && Array.isArray(remote.categories)
          ? normalize(remote)
          : defaultCatalog;
      latest.current = list;
      setCatalog(list);
      setPhase("ready");
    } catch {
      setPhase("unreachable");
    }
  }, []);

  const push = useCallback(async () => {
    const sending = latest.current;
    const mine = version.current;
    if (!sending) return;
    try {
      const res = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sending),
      });
      // If the list changed while this was in flight, a newer save is already
      // queued; this one's outcome must not mark that newer edit as saved.
      if (mine !== version.current) return;
      if (res.ok) return setSave({ kind: "saved" });
      const { error } = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setSave({
        kind: "failed",
        message:
          res.status === 401
            ? "Signed out — sign in again"
            : (error ?? "The cloud didn’t accept it"),
      });
    } catch {
      if (mine === version.current)
        setSave({ kind: "failed", message: "No connection" });
    }
  }, []);

  const update = useCallback(
    (next: Catalog) => {
      latest.current = next;
      version.current += 1;
      setCatalog(next);
      setSave({ kind: "saving" });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void push(), 800);
    },
    [push],
  );

  const retry = useCallback(() => {
    setSave({ kind: "saving" });
    void push();
  }, [push]);

  useEffect(() => {
    // The first load starts on the next tick, from a timer callback rather than
    // the effect body: it sets state, and setting state straight from an effect
    // renders twice for nothing. It is cleared if the component goes first.
    const first = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(first);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load]);

  // The only copy of an unsaved edit is in this tab.
  const unsaved = save.kind !== "saved";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  /** For the "Try again" button: show the spinner screen, then ask again. */
  const reload = useCallback(() => {
    setPhase("loading");
    void load();
  }, [load]);

  return { catalog, phase, save, update, retry, reload };
}
