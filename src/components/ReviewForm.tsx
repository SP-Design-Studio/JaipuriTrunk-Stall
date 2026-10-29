"use client";

import { useState } from "react";
import { REVIEW_MAX } from "@/lib/validate";

/**
 * The review: stars, an optional comment, and permission to show it publicly.
 * Used on the receipt link (as the first screen, skippable) and on its own page.
 * Built for a phone held in one hand: big stars, one full-width button, nothing
 * to type except the optional comment.
 */
const WORDS = [
  "",
  "Not good",
  "Could be better",
  "It was okay",
  "Really good",
  "Loved it!",
];

export default function ReviewForm({
  token,
  onSubmitted,
  onSkip,
}: {
  /** The receipt link's token: it proves this is a real bill. */
  token: string;
  onSubmitted: () => void;
  /** When given, a "Skip for now" link is shown. */
  onSkip?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showPublic, setShowPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, rating, comment, showPublic }),
      });
      if (res.ok || res.status === 409) {
        // 409: already reviewed (say, on another phone). Same outcome: done.
        onSubmitted();
        return;
      }
      const { error: e } = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(e ?? "Couldn’t send that. Please try again.");
    } catch {
      setError("No connection. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm px-5 py-8 text-center">
      <h1 className="font-display text-maroon text-2xl leading-snug">
        How was your purchase?
      </h1>
      <p className="text-ink/60 mt-1 text-sm">It takes about ten seconds.</p>

      <div
        role="radiogroup"
        aria-label="Your rating"
        className="mt-6 flex justify-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className={`size-14 text-5xl leading-none transition-transform active:scale-90 ${
              n <= rating ? "text-[#f49b49]" : "text-ink/20"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        className="text-maroon mt-1 min-h-6 text-sm font-semibold"
      >
        {WORDS[rating]}
      </p>

      <label className="mt-4 block text-left text-xs tracking-[0.14em] uppercase">
        Tell us more (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, REVIEW_MAX))}
          rows={4}
          placeholder="What did you like? What could we do better?"
          className="border-maroon/30 mt-1 w-full border bg-white/80 p-3 text-base normal-case tracking-normal"
        />
        <span className="text-ink/40 block text-right text-xs normal-case tracking-normal">
          {comment.length}/{REVIEW_MAX}
        </span>
      </label>

      {rating > 0 && (
        <label className="mt-2 flex items-start gap-3 text-left text-sm">
          <input
            type="checkbox"
            checked={showPublic}
            onChange={(e) => setShowPublic(e.target.checked)}
            className="mt-0.5 size-6 shrink-0"
          />
          <span>
            It’s okay to show this review publicly with my first name.
            <span className="text-ink/50 block text-xs">
              Leave this unticked and only our team will see it.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={() => void submit()}
        disabled={!rating || busy}
        className="bg-maroon text-cream mt-5 min-h-14 w-full text-base font-semibold tracking-wide disabled:opacity-45"
      >
        {busy ? "Sending…" : "Send my review"}
      </button>
      {onSkip && (
        <button
          onClick={onSkip}
          className="text-ink/60 mt-2 min-h-12 w-full text-sm underline"
        >
          Skip for now, show my bill
        </button>
      )}
    </div>
  );
}
