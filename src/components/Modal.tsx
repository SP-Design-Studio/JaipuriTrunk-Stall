"use client";

import { useEffect } from "react";

/** A centred sheet over a dimmed screen. Escape or a tap outside closes it. */
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
  large = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** Wide enough for two columns on an iPad in landscape. */
  large?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/55 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bg-cream border-maroon/20 my-auto w-full ${large ? "max-w-3xl" : wide ? "max-w-md" : "max-w-sm"} border p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-maroon text-xl">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink/50 hover:text-ink -mr-2 inline-flex size-11 items-center justify-center text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
