"use client";

import { useState } from "react";
import { BUSINESS } from "@/lib/config";

/**
 * Covers the whole till once the session has ended. The till underneath is hidden
 * but not thrown away, so a bill that was being rung up (or a sale that had not
 * saved yet) is still there after signing in again.
 */
export default function SessionExpired({
  onSignedIn,
}: {
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setPassword("");
        onSignedIn();
        return;
      }
      const { error: message } = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(message ?? "Could not sign in.");
    } catch {
      setError("No connection. Check the Wi-Fi and try again.");
    }
    setBusy(false);
  }

  const field =
    "bg-cream border-maroon/25 focus:border-maroon w-full border px-4 py-3 text-base outline-none";
  const label = "text-olive/80 mb-1 block text-xs tracking-[0.18em] uppercase";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="expired-title"
      className="bg-cream fixed inset-0 z-[100] grid place-items-center overflow-y-auto px-6 py-10"
    >
      <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="Jaipuri Trunk"
            className="mx-auto size-28"
          />
          <h1
            id="expired-title"
            className="font-display text-maroon mt-4 text-2xl"
          >
            Signed out
          </h1>
          <p className="text-ink/60 mt-1 text-sm">
            Your session ended, so the till is locked. Sign in to carry on; a
            bill you were ringing up is still here.
          </p>
        </div>

        <div>
          <label htmlFor="expired-email" className={label}>
            Email
          </label>
          <input
            id="expired-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
            required
            className={field}
          />
        </div>
        <div>
          <label htmlFor="expired-password" className={label}>
            Password
          </label>
          <input
            id="expired-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={field}
          />
        </div>

        {error && (
          <p role="alert" className="text-maroon text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="bg-maroon text-cream hover:bg-maroon-deep min-h-14 w-full text-base font-semibold tracking-wide transition-colors disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in again"}
        </button>

        <p className="text-ink/40 text-center text-xs">
          {BUSINESS.name} · staff only
        </p>
      </form>
    </div>
  );
}
