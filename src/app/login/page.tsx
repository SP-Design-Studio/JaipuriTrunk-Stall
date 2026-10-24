"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUSINESS } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
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
        router.replace("/");
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

  return (
    <main className="bg-cream grid min-h-dvh place-items-center px-6 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="Jaipuri Trunk"
            className="mx-auto size-40"
          />
          <p className="text-olive/80 mt-4 text-xs tracking-[0.3em] uppercase">
            Stall till
          </p>
        </div>

        <div>
          <label
            htmlFor="email"
            className="text-olive/80 mb-1 block text-xs tracking-[0.18em] uppercase"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className={field}
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="text-olive/80 mb-1 block text-xs tracking-[0.18em] uppercase"
          >
            Password
          </label>
          <input
            id="password"
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
          {busy ? "Signing in…" : "Open the till"}
        </button>

        <p className="text-ink/40 text-center text-xs">
          {BUSINESS.name} · staff only
        </p>
      </form>
    </main>
  );
}
