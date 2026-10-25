"use client";

import { useState } from "react";

/**
 * A month calendar that picks one day or a run of days, drawn by the app instead
 * of the browser. The browser's own date popup is different on every device
 * (and absent in some), so a till that must work the same everywhere draws its
 * own. Tap a day for a one-day stall; tap a second day later on for several.
 *
 * Days are plain YYYY-MM-DD strings, worked out in UTC so the device's time zone
 * can never shift one.
 */
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RangeCalendar({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (from: string, to: string) => void;
}) {
  const start = from ?? new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const [month, setMonth] = useState(Number(start.slice(5, 7)) - 1);
  // After the first tap the next tap picks the last day.
  const [waiting, setWaiting] = useState(false);

  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];

  function shift(by: number) {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  function tap(day: number) {
    const d = iso(year, month, day);
    if (!waiting || !from || d < from) {
      onChange(d, d);
      setWaiting(true);
    } else {
      onChange(from, d);
      setWaiting(false);
    }
  }

  const arrow =
    "text-maroon grid size-11 place-items-center text-xl hover:bg-petal";

  return (
    <div className="border-maroon/20 bg-white/70 border p-2">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className={arrow}
        >
          ‹
        </button>
        <div className="font-display text-maroon">
          {MONTHS[month]} {year}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className={arrow}
        >
          ›
        </button>
      </div>
      <div className="text-ink/50 grid grid-cols-7 text-center text-xs">
        {DAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const d = iso(year, month, day);
          const end = to ?? from;
          const inside = !!from && !!end && d >= from && d <= end;
          const edge = d === from || d === end;
          return (
            <button
              type="button"
              key={d}
              onClick={() => tap(day)}
              aria-label={d}
              aria-pressed={inside}
              className={`min-h-11 text-sm ${
                edge
                  ? "bg-maroon text-cream font-semibold"
                  : inside
                    ? "bg-blush/60 text-maroon-deep"
                    : "hover:bg-petal"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-ink/50 mt-1 px-1 text-xs">
        {waiting
          ? "Now tap the last day, or tap the same day again for one day."
          : "Tap a day. For several days, tap the first, then the last."}
      </p>
    </div>
  );
}
