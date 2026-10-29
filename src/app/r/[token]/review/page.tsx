import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewStandalone from "@/components/ReviewStandalone";
import { idFromToken } from "@/lib/receiptlink";
import { available, findReview, findSale } from "@/lib/store";

/**
 * The review on its own page: the link for a WhatsApp message. Same signed token
 * as the receipt, so only a real bill gets here. A wrong or altered link is a
 * plain 404.
 */
export const metadata: Metadata = {
  title: "Your review",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const id = idFromToken(token);
  if (!id || !available()) notFound();
  if (!(await findSale(id))) notFound();
  let reviewed = false;
  try {
    reviewed = (await findReview(id)) !== null;
  } catch {
    // Reviews not set up yet: show the form; saving will say if it can't.
  }
  return (
    <ReviewStandalone
      token={token}
      billPath={`/r/${raw}`}
      alreadyDone={reviewed}
    />
  );
}
