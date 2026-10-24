import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `next dev` and `next build` both own `.next`, and Next 16 refuses to start a
   * second dev server in the same folder. Setting NEXT_DIST_DIR sends a run
   * somewhere else, so a verification build or a second server can sit alongside
   * the one you are working in. Unset in normal use and on Vercel.
   */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
