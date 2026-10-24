import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReceiptView from "@/components/ReceiptView";
import { idFromToken, withProof } from "@/lib/receiptlink";
import { available, findSale } from "@/lib/store";

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
  const { token } = await params;
  const id = idFromToken(decodeURIComponent(token));
  if (!id || !available()) notFound();
  const sale = await findSale(id);
  if (!sale) notFound();
  // Name and phone never leave the server on this route.
  return (
    <ReceiptView
      sale={{
        ...withProof(sale),
        customerName: "",
        customerPhone: "",
        marketingOk: false,
      }}
    />
  );
}
