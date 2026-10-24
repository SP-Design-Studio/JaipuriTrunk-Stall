import type { Metadata, Viewport } from "next";
import { jost, marcellus, shivaraja, yatra } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "JaipuriTrunk Stall",
  description: "Till and receipts for the JaipuriTrunk stall.",
  // The whole app is private. robots.ts disallows everything too; this is the
  // belt to that pair of braces, because a crawler can ignore a robots file but
  // not a noindex.
  robots: { index: false, follow: false },
  /**
   * "Add to Home Screen" on the iPad then opens this as a full-screen app with
   * no Safari bars, which also removes the URL-bar resizing that affects
   * ordinary pages — there is no URL bar.
   */
  appleWebApp: {
    capable: true,
    title: "JT Till",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#7f1634",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      className={`${marcellus.variable} ${shivaraja.variable} ${yatra.variable} ${jost.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
