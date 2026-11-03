"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Option = { value: string; label: string };

/**
 * The stall's own dropdown, in place of the browser's. Looks like the rest of the
 * till (square edges, maroon and cream, a thumb-sized row for each choice) and
 * works from the keyboard: Enter, Space or the arrows open it, the arrows and
 * Home / End move, Enter picks, Escape closes, and typing a letter jumps to it.
 * Focus stays on the button, and the list is announced as a listbox.
 */
export default function Select({
  value,
  options,
  onChange,
  label,
  className = "",
  align = "left",
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** What the dropdown is for, read out by screen readers. */
  label: string;
  className?: string;
  /** Which edge of the button the list lines up with. */
  align?: "left" | "right";
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const selected = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const [active, setActive] = useState(selected);

  // A tap or click anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the highlighted row in view when the list scrolls.
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector<HTMLElement>(`[data-i="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    // Open upwards if there is more room above than below.
    const r = root.current?.getBoundingClientRect();
    if (r) {
      const room = window.innerHeight - r.bottom;
      setUp(room < 260 && r.top > room);
    }
    setActive(selected);
    setOpen(true);
  }

  function pick(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
      case "Tab":
        setOpen(false);
        return;
      case "ArrowDown":
        e.preventDefault();
        return setActive((i) => Math.min(i + 1, last));
      case "ArrowUp":
        e.preventDefault();
        return setActive((i) => Math.max(i - 1, 0));
      case "Home":
        e.preventDefault();
        return setActive(0);
      case "End":
        e.preventDefault();
        return setActive(last);
      case "Enter":
      case " ":
        e.preventDefault();
        return pick(active);
    }
    // Typing a few letters in a row jumps to the first choice that starts so.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = Date.now();
      const t = typed.current;
      t.text =
        now - t.at < 700 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
      t.at = now;
      const hit = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(t.text),
      );
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`border-maroon/25 text-maroon hover:bg-petal/60 focus-visible:outline-maroon flex min-h-11 w-full items-center justify-between gap-3 border bg-white/70 px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${open ? "border-maroon bg-petal/60" : ""}`}
      >
        <span className="truncate">{options[selected]?.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`text-maroon/70 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4.25 6 8.25l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={`border-maroon/30 bg-cream absolute z-40 max-h-64 min-w-full overflow-y-auto border shadow-[0_10px_28px_-8px_rgba(118,33,54,0.35)] ${up ? "bottom-full mb-1" : "top-full mt-1"} ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o, i) => {
            const on = i === selected;
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={on}
                // Keep focus on the button; a tap picks.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onPointerMove={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 px-3 text-sm whitespace-nowrap ${i === active ? "bg-petal" : ""} ${on ? "text-maroon font-semibold" : "text-ink"}`}
              >
                <span>{o.label}</span>
                {on && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    aria-hidden="true"
                    className="text-sage shrink-0"
                  >
                    <path
                      d="m2.5 6.75 2.75 2.75 5.25-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
