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
import { BACKUP_APP, backupOf } from "@/lib/backup";
import { downloadText } from "@/lib/download";
import { todayKey } from "@/lib/time";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import type { useTemplates } from "./useTemplates";
import type { useUpiQr } from "./useUpiQr";

/**
 * Things set once rather than per sale: the UPI QR and the WhatsApp wording.
 * Both live in the database; nothing here is kept on the iPad.
 */
export default function Settings({
  qr,
  templates,
  sales,
  onWiped,
  onRestored,
}: {
  qr: ReturnType<typeof useUpiQr>;
  templates: ReturnType<typeof useTemplates>;
  sales: Sale[];
  onWiped: () => void;
  onRestored: () => void;
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

        <BackupCard sales={sales} onRestored={onRestored} className={card} />

        <DangerZone sales={sales} onWiped={onWiped} className={card} />
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

/**
 * Start again: delete every bill, which also takes the bill number back to 0001.
 * The number is "one more than the latest bill", so there is nothing separate to
 * reset. Deliberately awkward: a backup is offered first, and it takes the
 * password and the word DELETE.
 */
function DangerZone({
  sales,
  onWiped,
  className,
}: {
  sales: Sale[];
  onWiped: () => void;
  className: string;
}) {
  // 0 closed, 1 the warning, 2 the last chance.
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function close() {
    setStep(0);
    setWord("");
    setPassword("");
    setError("");
  }

  async function wipe() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm: word }),
      });
      if (!res.ok) {
        const { error: e } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(e ?? "Couldn’t delete.");
      } else {
        onWiped();
        setDone(true);
        close();
      }
    } catch {
      setError("No connection.");
    }
    setBusy(false);
  }

  const field =
    "border-maroon/30 bg-white/70 min-h-12 w-full border px-3 text-base";

  return (
    <section className={`${className} !border-red-700`}>
      <h3 className="font-display text-lg text-red-700">Start again</h3>
      <p className="text-ink/60 text-sm">
        Deletes <strong>every bill</strong> and starts the bill numbers again at
        0001. For clearing out test sales before the real day. It can’t be
        undone, and bills are your sales records, so don’t do this once real
        sales have been made.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStep(1)}
          className="min-h-11 bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Delete all bills…
        </button>
        {done && (
          <span role="status" className="text-olive text-sm">
            All bills deleted. The next bill will be 0001.
          </span>
        )}
      </div>

      {step === 1 && (
        <Modal title="Delete all bills?" onClose={close} wide>
          <p
            role="alert"
            className="border border-red-700 bg-red-50 p-3 text-sm text-red-900"
          >
            <strong>Warning: this can’t be undone.</strong> It permanently
            deletes{" "}
            <strong>
              {sales.length} bill{sales.length === 1 ? "" : "s"}
            </strong>{" "}
            from the cloud, including customers’ names and phone numbers, and
            the bill numbers start again at 0001.
          </p>
          <button
            onClick={() =>
              downloadText(
                `JaipuriTrunk-bills-backup-${todayKey()}.json`,
                backupOf(sales),
                "application/json",
              )
            }
            disabled={sales.length === 0}
            className="border-maroon/30 text-maroon mt-3 min-h-11 w-full border px-4 text-sm font-semibold disabled:opacity-40"
          >
            Download a backup first (can be restored)
          </button>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={close}
              className="border-maroon/30 text-maroon min-h-12 border px-4 text-sm font-semibold"
            >
              Cancel — keep my bills
            </button>
            <button
              onClick={() => setStep(2)}
              className="min-h-12 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
            >
              Continue…
            </button>
          </div>
        </Modal>
      )}

      {step === 2 && (
        <Modal title="Last chance" onClose={close} wide>
          <p
            role="alert"
            className="border border-red-700 bg-red-50 p-3 text-sm text-red-900"
          >
            Final check. Once you press the red button,{" "}
            <strong>
              all {sales.length} bill{sales.length === 1 ? "" : "s"} are gone
              for good.
            </strong>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void wipe();
            }}
            className="mt-4 space-y-3"
          >
            <label className="block text-xs tracking-[0.14em] uppercase">
              Type DELETE
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-xs tracking-[0.14em] uppercase">
              Your login password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`${field} mt-1`}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={close}
                className="border-maroon/30 text-maroon min-h-12 border px-4 text-sm font-semibold"
              >
                No, go back
              </button>
              <button
                type="submit"
                disabled={busy || word !== "DELETE" || !password}
                className="min-h-12 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-45"
              >
                {busy ? "Deleting…" : "Yes, delete everything"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/**
 * A backup file of every bill, and putting one back. The Bills CSV on the Sales
 * tab is a report for spreadsheets and can't be restored from; this file can.
 * Restoring skips any bill already here, so it is safe to run twice.
 */
function BackupCard({
  sales,
  onRestored,
  className,
}: {
  sales: Sale[];
  onRestored: () => void;
  className: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function restore(file: File) {
    setBusy(true);
    setResult("");
    try {
      const parsed = JSON.parse(await file.text()) as {
        app?: string;
        sales?: unknown[];
      };
      if (parsed.app !== BACKUP_APP || !Array.isArray(parsed.sales))
        throw new Error("That isn’t a bills backup from this till.");
      const total = { added: 0, skipped: 0, conflicts: 0, rejected: 0 };
      for (let i = 0; i < parsed.sales.length; i += 200) {
        const res = await fetch("/api/sales/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sales: parsed.sales.slice(i, i + 200) }),
        });
        if (!res.ok) throw new Error("Couldn’t finish restoring. Try again.");
        const r = (await res.json()) as typeof total;
        for (const k of Object.keys(total) as (keyof typeof total)[])
          total[k] += r[k];
      }
      setResult(
        `Restored ${total.added} bill${total.added === 1 ? "" : "s"}` +
          (total.skipped ? `, ${total.skipped} already here` : "") +
          (total.conflicts
            ? `, ${total.conflicts} skipped (bill number already used by a different bill)`
            : "") +
          (total.rejected ? `, ${total.rejected} unreadable` : "") +
          ".",
      );
      onRestored();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Couldn’t read that file.");
    }
    setBusy(false);
  }

  return (
    <section className={className}>
      <h3 className="font-display text-maroon text-lg">Backup &amp; restore</h3>
      <p className="text-ink/60 text-sm">
        Download every bill as a backup file, and put it back later if bills are
        lost or deleted. (The CSVs on the Sales tab are reports for
        spreadsheets; they can’t be restored.) Restoring keeps each bill’s
        number and skips any already here.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            downloadText(
              `JaipuriTrunk-bills-backup-${todayKey()}.json`,
              backupOf(sales),
              "application/json",
            )
          }
          disabled={sales.length === 0}
          className="bg-maroon text-cream min-h-11 px-4 text-sm font-semibold disabled:opacity-45"
        >
          Download backup ({sales.length})
        </button>
        <label
          className={`border-maroon/30 text-maroon inline-flex min-h-11 cursor-pointer items-center border px-4 text-sm font-semibold ${busy ? "opacity-45" : ""}`}
        >
          {busy ? "Restoring…" : "Restore from backup…"}
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void restore(file);
            }}
          />
        </label>
      </div>
      {result && (
        <p role="status" className="text-ink/80 text-sm">
          {result}
        </p>
      )}
    </section>
  );
}
