import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReceiptView from "@/components/ReceiptView";
import { idFromToken, withProof } from "@/lib/receiptlink";
import { available, findReview, findSale } from "@/lib/store";

/**
 * A customer's receipt, reachable only through the signed link the till gave
 * them. Anyone holding the link can open it, so what it shows is what is already
 * on the paper: the bill, never the phone number or the name. A wrong or altered
 * link is a plain 404 — no hint whether such a bill exists.
 */
export const metadata: Metadata = {
  title: "Your receipt",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const id = idFromToken(token);
  if (!id || !available()) notFound();
  const sale = await findSale(id);
  if (!sale) notFound();
  // Ask for a review first, unless this bill has one. If reviews cannot be read
  // (the migration is not run yet) the bill simply opens as before.
  let askReview = false;
  try {
    askReview = (await findReview(id)) === null;
  } catch {
    askReview = false;
  }
  // Name and phone never leave the server on this route.
  return (
    <ReceiptView
      token={token}
      askReview={askReview}
      sale={{
        ...withProof(sale),
        customerName: "",
        customerPhone: "",
        marketingOk: false,
      }}
    />
  );
}
