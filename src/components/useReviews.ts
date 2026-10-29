"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Review, ReviewStatus } from "@/lib/types";

/**
 * Buyers' reviews, read from the database and held in memory only (staff see
 * them on the Sales tab). null until the first answer, or if they can't be read
 * (say the reviews migration hasn't been run): the till just shows none.
 */
export function useReviews() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [statuses, setStatuses] = useState<ReviewStatus[]>([]);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        reviews: Review[];
        statuses?: ReviewStatus[];
      };
      if (alive.current) {
        setReviews(body.reviews);
        setStatuses(body.statuses ?? []);
      }
    } catch {
      // Keeps what it had; the next refresh tries again.
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 120_000);
    return () => {
      alive.current = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { reviews, statuses, refresh };
}
