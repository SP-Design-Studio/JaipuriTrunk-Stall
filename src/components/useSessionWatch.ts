"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How often an open till checks it is still signed in. */
const EVERY_MS = 20_000;

/**
 * Notices a session that has timed out, and keeps one alive while the till is in
 * use. The server already refuses signed-out requests; this is what lets the
 * screen react, instead of carrying on showing the stall's figures to whoever
 * picks up an unattended till.
 *
 * Taps, keys and scrolling count as use. At each check the till says whether there
 * was any since the last one, and the server renews the session if so; a till left
 * alone is not renewed and locks once its time is up. It checks on a timer and
 * whenever the tab comes back or the network returns. Failing to reach the server
 * is not "signed out": only a 401 is. `forced` lets a caller that has already seen
 * a 401 itself lock the screen at once.
 */
export function useSessionWatch(forced: boolean) {
  const [out, setOut] = useState(false);
  // Set by any use, cleared when it has been reported. A ref: it must not re-render.
  const used = useRef(false);

  const check = useCallback(async () => {
    const active = used.current;
    used.current = false;
    try {
      const res = await fetch(`/api/session${active ? "?active=1" : ""}`, {
        cache: "no-store",
      });
      if (res.status === 401) setOut(true);
    } catch {
      // Offline or the server is down: not the same as signed out. Keep the
      // use for the next check, so it is not lost.
      used.current = used.current || active;
    }
  }, []);

  useEffect(() => {
    const mark = () => {
      used.current = true;
    };
    const timer = window.setInterval(() => void check(), EVERY_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onBack = () => void check();
    const uses = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const e of uses) window.addEventListener(e, mark, { passive: true });
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onBack);
    window.addEventListener("online", onBack);
    return () => {
      window.clearInterval(timer);
      for (const e of uses) window.removeEventListener(e, mark);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("online", onBack);
    };
  }, [check]);

  return {
    signedOut: out || forced,
    /** Called once the person has signed in again. */
    signedIn: useCallback(() => setOut(false), []),
  };
}
