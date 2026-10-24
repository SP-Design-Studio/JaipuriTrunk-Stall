import localFont from "next/font/local";
import { Marcellus, Yatra_One, Jost } from "next/font/google";

export const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});

/** Fallback for Shivaraja — also covers any glyph Shivaraja lacks. */
export const yatra = Yatra_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-yatra",
  display: "swap",
});

export const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

/** The brand script, self-hosted from /public/fonts/Shivaraja.ttf. */
export const shivaraja = localFont({
  src: "../../public/fonts/Shivaraja.ttf",
  variable: "--font-shivaraja",
  display: "swap",
  preload: true,
});
