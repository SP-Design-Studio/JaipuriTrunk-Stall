"use client";

import { useMemo, useState } from "react";
import type { Sale, StallEntry } from "@/lib/types";
import { dayKey, todayKey } from "@/lib/time";

/** The Today / All sales / stall choice shared by Sales and Analysis. */
export function useSalesFilter(
  sales: Sale[],
  stalls: StallEntry[],
  currentStall?: string,
) {
  const [range, setRange] = useState<"today" | "all">("today");
  const [stallFilter, setStallFilter] = useState("all");

  // The dropdown lists every stall that has bills, and the current one even
  // before its first bill, so choosing "This stall" always has an entry.
  const stallOptions = useMemo(() => {
    const withBills = sales
      .map((s) => s.stall?.name)
      .filter(Boolean) as string[];
    return [
      ...new Set([
        ...stalls.map((x) => x.name),
        ...withBills,
        ...(currentStall ? [currentStall] : []),
      ]),
    ];
  }, [sales, stalls, currentStall]);

  const shown = useMemo(
    () =>
      sales.filter(
        (s) =>
          (range === "all" || dayKey(s.createdAt) === todayKey()) &&
          (stallFilter === "all" || s.stall?.name === stallFilter),
      ),
    [sales, range, stallFilter],
  );

  return {
    range,
    setRange,
    stallFilter,
    setStallFilter,
    stallOptions,
    shown,
    currentStall,
  };
}

export type SalesFilter = ReturnType<typeof useSalesFilter>;

const tab = (on: boolean) =>
  `inline-flex min-h-11 items-center border px-4 text-sm transition-colors ${
    on
      ? "bg-maroon border-maroon text-cream"
      : "border-maroon/25 text-maroon hover:bg-petal"
  }`;

export function FilterBar({ filter }: { filter: SalesFilter }) {
  const {
    range,
    setRange,
    stallFilter,
    setStallFilter,
    stallOptions,
    currentStall,
  } = filter;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => {
          setRange("today");
          setStallFilter("all");
        }}
        className={tab(range === "today" && stallFilter === "all")}
      >
        Today
      </button>
      <button
        onClick={() => {
          setRange("all");
          setStallFilter("all");
        }}
        className={tab(range === "all" && stallFilter === "all")}
      >
        All sales
      </button>
      {currentStall && (
        <button
          onClick={() => {
            setStallFilter(currentStall);
            setRange("all");
          }}
          className={tab(range === "all" && stallFilter === currentStall)}
        >
          This stall
        </button>
      )}
      {stallOptions.length > 0 && (
        <select
          value={stallFilter}
          onChange={(e) => {
            setStallFilter(e.target.value);
            // Looking at a past stall means looking at all of its days.
            if (e.target.value !== "all") setRange("all");
          }}
          aria-label="Filter by stall"
          className="border-maroon/25 text-maroon min-h-11 border bg-white/70 px-3 text-sm"
        >
          <option value="all">All stalls</option>
          {stallOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
