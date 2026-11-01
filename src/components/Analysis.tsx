"use client";

import { useMemo, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import type { Review, Sale, StallEntry } from "@/lib/types";
import Insights from "./Insights";
import OffersView from "./OffersView";
import StallsView from "./StallsView";
import TrendView from "./TrendView";
import { stallStats } from "@/lib/stallStats";
import ProductMoney from "./ProductMoney";
import { FilterBar, useSalesFilter } from "./useSalesFilter";

const tab = (on: boolean) =>
  `inline-flex min-h-11 items-center border px-4 text-sm transition-colors ${
    on
      ? "bg-maroon border-maroon text-cream"
      : "border-maroon/25 text-maroon hover:bg-petal"
  }`;

/** Read-only analysis of the sales: money by product, and shopper patterns. */
export default function Analysis({
  sales,
  catalog,
  reviews,
  stalls,
  currentStall,
}: {
  sales: Sale[];
  catalog: Catalog | null;
  /** Buyers' reviews; null if they cannot be read. */
  reviews: Review[] | null;
  stalls: StallEntry[];
  currentStall?: string;
}) {
  const filter = useSalesFilter(sales, stalls, currentStall);
  const [view, setView] = useState<
    "money" | "offers" | "stalls" | "trend" | "insights"
  >("money");
  const reviewMap = useMemo(
    () => new Map((reviews ?? []).map((r) => [r.saleId, r])),
    [reviews],
  );
  const { shown, stallFilter, range } = filter;
  // Stalls and trends compare every stall, so they ignore the Today / stall filter.
  const stats = useMemo(
    () => stallStats(sales, stalls, catalog),
    [sales, stalls, catalog],
  );
  const looseBills = useMemo(
    () => sales.filter((s) => !s.stall?.name).length,
    [sales],
  );
  const allStalls = view === "stalls" || view === "trend";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4 pb-8">
        {!allStalls && <FilterBar filter={filter} />}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView("money")}
            className={tab(view === "money")}
          >
            Products &amp; money
          </button>
          <button
            onClick={() => setView("offers")}
            className={tab(view === "offers")}
          >
            Offers
          </button>
          <button
            onClick={() => setView("stalls")}
            className={tab(view === "stalls")}
          >
            Stalls &amp; profit
          </button>
          <button
            onClick={() => setView("trend")}
            className={tab(view === "trend")}
          >
            Trend
          </button>
          <button
            onClick={() => setView("insights")}
            className={tab(view === "insights")}
          >
            Insights
          </button>
        </div>

        {view === "money" && (
          <ProductMoney
            sales={shown}
            catalog={catalog}
            label={
              stallFilter !== "all"
                ? stallFilter
                : range === "today"
                  ? "today"
                  : "all-sales"
            }
          />
        )}
        {view === "offers" && <OffersView sales={shown} catalog={catalog} />}
        {view === "stalls" && (
          <StallsView stats={stats} looseBills={looseBills} />
        )}
        {view === "trend" && <TrendView stats={stats} />}
        {view === "insights" && (
          <Insights sales={shown} allSales={sales} reviews={reviewMap} />
        )}
      </div>
    </div>
  );
}
