"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Short messages for the things that matter, in colours that say what they are:
 * green for done, red for failed, amber for "done, but look", blue for a plain
 * heads-up. They sit at the top, over everything including popups, fade on
 * their own (errors stay longest), and can be dismissed with a tap.
 *
 * Outside the provider the calls do nothing, so a component can use them
 * without caring where it is rendered.
 */
type Kind = "success" | "error" | "warning" | "info";
type Toast = { id: number; kind: Kind; text: string };
type Api = Record<Kind, (text: string) => void>;

const NONE: Api = {
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
};
const Ctx = createContext<Api>(NONE);
export const useToast = () => useContext(Ctx);

const LIFE: Record<Kind, number> = {
  success: 3500,
  info: 4500,
  warning: 7000,
  error: 8000,
};

const LOOK: Record<Kind, { box: string; icon: string; label: string }> = {
  success: { box: "bg-emerald-700 text-white", icon: "✓", label: "Done" },
  error: { box: "bg-red-700 text-white", icon: "✕", label: "Problem" },
  warning: { box: "bg-amber-400 text-amber-950", icon: "!", label: "Check" },
  info: { box: "bg-sky-700 text-white", icon: "i", label: "Note" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const recent = useRef(new Map<string, number>());

  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const push = useCallback(
    (kind: Kind, text: string) => {
      // The same message twice within a second is one message.
      const key = `${kind}:${text}`;
      const now = Date.now();
      if (now - (recent.current.get(key) ?? 0) < 1000) return;
      recent.current.set(key, now);
      const id = next.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), LIFE[kind]);
    },
    [dismiss],
  );

  const api = useMemo<Api>(
    () => ({
      success: (t) => push("success", t),
      error: (t) => push("error", t),
      warning: (t) => push("warning", t),
      info: (t) => push("info", t),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 px-4 py-3 text-sm shadow-xl ${LOOK[t.kind].box}`}
          >
            <span
              aria-label={LOOK[t.kind].label}
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold"
            >
              {LOOK[t.kind].icon}
            </span>
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-my-1 -mr-2 size-9 shrink-0 text-lg leading-none opacity-80"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
