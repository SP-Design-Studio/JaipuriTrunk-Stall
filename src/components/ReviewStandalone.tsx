"use client";

import { useState } from "react";
import ReviewForm from "./ReviewForm";

/** The review on a page of its own (the link in a WhatsApp message). */
export default function ReviewStandalone({
  token,
  billPath,
  alreadyDone,
}: {
  token: string;
  billPath: string;
  alreadyDone: boolean;
}) {
  const [done, setDone] = useState(alreadyDone);
  return (
    <main className="bg-cream flex min-h-dvh flex-col items-center justify-center">
      {done ? (
        <div className="mx-auto max-w-sm px-6 py-10 text-center">
          <div className="text-5xl text-[#f49b49]" aria-hidden="true">
            ★
          </div>
          <h1 className="font-display text-maroon mt-3 text-2xl">
            {alreadyDone ? "You’ve already reviewed this" : "Thank you!"}
          </h1>
          <p className="text-ink/70 mt-2 text-sm">
            It means a lot to a small shop like ours.
          </p>
          <a
            href={billPath}
            className="bg-maroon text-cream mt-6 inline-flex min-h-14 w-full items-center justify-center text-base font-semibold"
          >
            View my bill
          </a>
        </div>
      ) : (
        <ReviewForm token={token} onSubmitted={() => setDone(true)} />
      )}
    </main>
  );
}
