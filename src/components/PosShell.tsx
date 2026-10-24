"use client";

import dynamic from "next/dynamic";

/**
 * Rendered only in the browser. The till reads `window` and `document` as soon
 * as it mounts (the clock, visibility, the share sheet), none of which exist on
 * the server, and rendering it there first would only produce a flash of a
 * different page that hydration then has to correct.
 */
const Pos = dynamic(() => import("./Pos"), {
  ssr: false,
  loading: () => (
    <div className="bg-cream text-maroon/60 grid h-dvh place-items-center text-sm tracking-[0.2em] uppercase">
      Opening the till…
    </div>
  ),
});

export default function PosShell() {
  return <Pos />;
}
