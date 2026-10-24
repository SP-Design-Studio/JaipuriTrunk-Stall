"use client";

import { useState } from "react";
import { inr } from "@/lib/money";
import {
  MAX_TEMPLATE,
  PLACEHOLDERS,
  defaultTemplates,
  render,
  type Templates,
} from "@/lib/messages";
import type { useTemplates } from "./useTemplates";
import type { useUpiQr } from "./useUpiQr";

/**
 * Things set once rather than per sale: the UPI QR and the WhatsApp wording.
 * Both live in the database; nothing here is kept on the iPad.
 */
export default function Settings({
  qr,
  templates,
}: {
  qr: ReturnType<typeof useUpiQr>;
  templates: ReturnType<typeof useTemplates>;
}) {
  const card = "border-maroon/15 space-y-3 border bg-white/50 p-4";
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-5 pb-10">
        <section className={card}>
          <h3 className="font-display text-maroon text-lg">UPI QR</h3>
          <p className="text-ink/60 text-sm">
            Upload a screenshot or photo of your UPI QR. It is kept in the cloud
            and shown full-screen at the till when the customer pays by UPI.
          </p>
          {qr.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr.image}
              alt="Your UPI QR code"
              className="size-40 bg-white object-contain p-2"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="bg-maroon text-cream inline-flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
              {qr.image ? "Replace QR" : "Upload QR"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void qr.upload(file);
                }}
              />
            </label>
            {qr.image && (
              <button
                onClick={() => void qr.remove()}
                className="border-maroon/30 text-maroon min-h-11 border px-4 text-sm font-semibold"
              >
                Remove
              </button>
            )}
          </div>
          {qr.error && (
            <p role="alert" className="text-maroon text-sm">
              {qr.error}
            </p>
          )}
        </section>

        <MessageBuilder templates={templates} className={card} />
      </div>
    </div>
  );
}

const SAMPLE = {
  name: "Asha",
  bill: "JT-24102026-203015-0007",
  total: inr(1500),
  payment: "UPI",
  link: "https://your-till.example/r/…",
};

function MessageBuilder({
  templates,
  className,
}: {
  templates: ReturnType<typeof useTemplates>;
  className: string;
}) {
  const start = templates.saved ?? defaultTemplates();
  const [draft, setDraft] = useState<Templates>(start);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<keyof Templates>("receipt");

  // Adopt what loads from the database, once, unless editing has begun.
  const [adopted, setAdopted] = useState(templates.saved !== null);
  if (!adopted && templates.saved) {
    setAdopted(true);
    setDraft(templates.saved);
  }

  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(templates.saved ?? defaultTemplates());

  function insert(token: string) {
    setDraft((d) => ({ ...d, [focus]: `${d[focus]}${token}` }));
  }

  async function save() {
    setBusy(true);
    setStatus((await templates.save(draft)) ?? "Saved.");
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    const err = await templates.reset();
    if (!err) setDraft(defaultTemplates());
    setStatus(err ?? "Back to the standard wording.");
    setBusy(false);
  }

  const area =
    "border-maroon/30 bg-white/70 min-h-32 w-full border p-3 text-base leading-relaxed";
  const preview = (key: keyof Templates) =>
    render(draft[key], key === "receipt" ? SAMPLE : { name: SAMPLE.name });

  return (
    <section className={className}>
      <h3 className="font-display text-maroon text-lg">WhatsApp messages</h3>
      <p className="text-ink/60 text-sm">
        The wording of the two messages. Tap a tag to add it where you last
        typed; each is replaced with the real detail when the message is made. A
        line with a {"{link}"} or {"{instagram}"} that has nothing to fill is
        left out.
      </p>

      <div className="flex flex-wrap gap-2">
        {PLACEHOLDERS.map(([tag, what]) => (
          <button
            key={tag}
            onClick={() => insert(tag)}
            title={what}
            className="border-maroon/30 text-maroon min-h-11 border px-3 text-sm"
          >
            {tag}
          </button>
        ))}
      </div>

      {(
        [
          ["receipt", "After a sale — sent with the receipt link"],
          [
            "followUp",
            "Follow-up — only for customers who said yes to messages",
          ],
        ] as const
      ).map(([key, title]) => (
        <div key={key} className="space-y-2">
          <label className="block text-xs tracking-[0.14em] uppercase">
            {title}
            <textarea
              value={draft[key]}
              onFocus={() => setFocus(key)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [key]: e.target.value.slice(0, MAX_TEMPLATE),
                }))
              }
              className={`${area} mt-1 normal-case tracking-normal`}
            />
          </label>
          <div className="bg-olive/10 p-3 text-sm whitespace-pre-wrap">
            <span className="text-ink/50 block text-xs uppercase tracking-[0.14em]">
              Preview
            </span>
            {preview(key)}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={busy || !dirty}
          className="bg-maroon text-cream min-h-11 px-5 text-sm font-semibold disabled:opacity-45"
        >
          {busy ? "Saving…" : "Save messages"}
        </button>
        <button
          onClick={() => void reset()}
          disabled={busy}
          className="border-maroon/30 text-maroon min-h-11 border px-4 text-sm"
        >
          Use standard wording
        </button>
        <span role="status" className="text-ink/60 text-sm">
          {status}
        </span>
      </div>
    </section>
  );
}
