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
import { prettyRange, todayKey } from "@/lib/time";
import type { Sale } from "@/lib/types";
import Modal from "./Modal";
import RangeCalendar from "./RangeCalendar";
import { useToast } from "./Toasts";
import type { StallEntry } from "@/lib/types";
import type { useStalls } from "./useStalls";
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
  stallList,
  onWiped,
  onRestored,
}: {
  qr: ReturnType<typeof useUpiQr>;
  stallList: ReturnType<typeof useStalls>;
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

        <StallsCard stallList={stallList} className={card} />

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
  const toast = useToast();
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
    const err = await templates.save(draft);
    setStatus(err ?? "Saved.");
    if (err) toast.error(`Messages not saved: ${err}`);
    else toast.success("WhatsApp messages saved.");
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    const err = await templates.reset();
    if (!err) setDraft(defaultTemplates());
    setStatus(err ?? "Back to the standard wording.");
    if (err) toast.error(`Couldn’t reset: ${err}`);
    else toast.info("Messages are back to the standard wording.");
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
  const toast = useToast();

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
        toast.error(e ?? "Couldn’t delete the bills.");
      } else {
        onWiped();
        setDone(true);
        close();
        toast.success("All bills deleted. The next bill will be 0001.");
      }
    } catch {
      setError("No connection.");
      toast.error("No connection. Nothing was deleted.");
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
            onClick={() => {
              downloadText(
                `JaipuriTrunk-bills-backup-${todayKey()}.json`,
                backupOf(sales),
                "application/json",
              );
              toast.success(`Backup downloaded · ${sales.length} bills.`);
            }}
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
  const toast = useToast();

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
      // Green if bills came back; amber if some were skipped or unreadable;
      // blue if there was nothing new.
      if (total.added > 0 && !total.conflicts && !total.rejected)
        toast.success(
          `Restored ${total.added} bill${total.added === 1 ? "" : "s"}.`,
        );
      else if (total.added > 0)
        toast.warning(
          `Restored ${total.added}, but ${total.conflicts + total.rejected} couldn’t be restored.`,
        );
      else if (total.conflicts || total.rejected)
        toast.error(
          "No bills restored: the file had unreadable or clashing bills.",
        );
      else toast.info("Nothing new: every bill in that file is already here.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Couldn’t read that file.";
      setResult(message);
      toast.error(message);
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
          onClick={() => {
            downloadText(
              `JaipuriTrunk-bills-backup-${todayKey()}.json`,
              backupOf(sales),
              "application/json",
            );
            toast.success(`Backup downloaded · ${sales.length} bills.`);
          }}
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

/**
 * The stalls: one for each time the market happens, tracked on its own for the
 * books. Exactly one is "current"; every sale made meanwhile is recorded against
 * it and the receipt prints its name, address and phone. Start a new one when a
 * new month's stall begins, and last month's stays in the list, with its sales,
 * to look back on in Sales.
 */
function StallsCard({
  stallList,
  className,
}: {
  stallList: ReturnType<typeof useStalls>;
  className: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<StallEntry[]>(stallList.stalls ?? []);
  const [current, setCurrent] = useState<string | null>(stallList.currentId);
  const [adopted, setAdopted] = useState(stallList.stalls !== null);
  if (!adopted && stallList.stalls) {
    setAdopted(true);
    setDraft(stallList.stalls);
    setCurrent(stallList.currentId);
  }
  const [busy, setBusy] = useState(false);
  const dirty =
    JSON.stringify([draft, current]) !==
    JSON.stringify([stallList.stalls ?? [], stallList.currentId]);

  const patch = (id: string, p: Partial<StallEntry>) =>
    setDraft((d) => d.map((s) => (s.id === id ? { ...s, ...p } : s)));

  async function save() {
    const names = draft.map((s) => s.name.trim().toLowerCase());
    if (names.some((n) => !n))
      return void toast.error("Every stall needs a name.");
    if (new Set(names).size !== names.length)
      return void toast.error("Two stalls have the same name.");
    if (draft.some((s) => !s.from || !s.to))
      return void toast.error("Pick the day or days each stall runs.");
    if (draft.some((s) => (s.to ?? "") < (s.from ?? "")))
      return void toast.error("A stall can’t end before it starts.");
    setBusy(true);
    const err = await stallList.save(
      draft.map((s) => ({
        ...s,
        name: s.name.trim(),
        address: s.address.trim(),
        phone: s.phone.trim(),
      })),
      current,
    );
    if (err) toast.error(`Stalls not saved: ${err}`);
    else toast.success("Stalls saved.");
    setBusy(false);
  }

  function startNew() {
    const id = crypto.randomUUID().slice(0, 8);
    const today = todayKey();
    setDraft((d) => [
      { id, name: "", address: "", phone: "", from: today, to: today },
      ...d,
    ]);
    setCurrent(id);
  }

  const field =
    "border-maroon/30 bg-white/70 min-h-11 w-full border px-3 text-base";
  const now = draft.find((s) => s.id === current);

  return (
    <section className={className}>
      <h3 className="font-display text-maroon text-lg">Stalls</h3>
      <p className="text-ink/60 text-sm">
        Each time the stall happens, start a new one here (for example “November
        2026 — Lamakaan”). Every bill is recorded against the current stall and
        its name, address and phone are printed on the receipt. Past stalls stay
        in the list and in Sales, so each one can be totalled and printed on its
        own.
      </p>

      {(() => {
        const saved = (stallList.stalls ?? []).find(
          (x) => x.id === stallList.currentId,
        );
        return (
          <div
            className={`p-3 text-sm ${saved ? "bg-emerald-50 text-emerald-900" : "bg-amber-100 text-amber-950"}`}
            role="status"
          >
            {saved ? (
              <>
                Current stall: <strong>{saved.name}</strong>
                {saved.from ? ` · ${prettyRange(saved.from, saved.to)}` : ""}.
                New bills go to it.
              </>
            ) : (stallList.stalls?.length ?? 0) > 0 ? (
              <>
                No stall is current, so new bills aren’t recorded against any.
                Make one current and save.
              </>
            ) : (
              <>
                No stall started yet. Bills are saved without one and receipts
                show the shop address.
              </>
            )}
          </div>
        );
      })()}
      {dirty && (
        <div
          role="alert"
          className="border border-amber-500 bg-amber-100 p-3 text-sm text-amber-950"
        >
          <strong>Not saved yet.</strong> Your changes
          {now ? ` (“${now.name || "new stall"}” as current)` : ""} only take
          effect after you tap <strong>Save stalls</strong> below.
        </div>
      )}

      <button
        onClick={startNew}
        disabled={draft.length >= 20}
        className="bg-maroon text-cream min-h-11 px-4 text-sm font-semibold disabled:opacity-45"
      >
        + Start a new stall
      </button>

      {draft.map((s) => (
        <div
          key={s.id}
          className={`space-y-2 border p-3 ${s.id === current ? "border-emerald-700" : "border-maroon/15"}`}
        >
          <input
            value={s.name}
            onChange={(e) => patch(s.id, { name: e.target.value })}
            maxLength={60}
            placeholder="Name, e.g. November 2026 — Lamakaan"
            aria-label="Stall name"
            className={field}
          />
          <input
            value={s.address}
            onChange={(e) => patch(s.id, { address: e.target.value })}
            maxLength={160}
            placeholder="Venue / address (printed on the receipt)"
            aria-label="Stall address"
            className={field}
          />
          <input
            value={s.phone}
            onChange={(e) => patch(s.id, { phone: e.target.value })}
            maxLength={30}
            placeholder="Phone (optional)"
            aria-label="Stall phone"
            inputMode="tel"
            className={field}
          />
          <RangeCalendar
            from={s.from}
            to={s.to}
            onChange={(from, to) => patch(s.id, { from, to })}
          />
          <p className="text-maroon text-sm font-semibold">
            {s.from ? prettyRange(s.from, s.to) : "Pick the day or days"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {s.id === current ? (
              <>
                <span className="min-h-11 inline-flex items-center bg-emerald-700 px-3 text-sm font-semibold text-white">
                  ✓ Current
                </span>
                <button
                  onClick={() => setCurrent(null)}
                  className="border-maroon/30 text-maroon min-h-11 border px-4 text-sm"
                >
                  End this stall
                </button>
              </>
            ) : (
              <button
                onClick={() => setCurrent(s.id)}
                className="border-maroon/30 text-maroon min-h-11 border px-4 text-sm font-semibold"
              >
                Make current
              </button>
            )}
            <button
              onClick={() => {
                setDraft((d) => d.filter((x) => x.id !== s.id));
                if (current === s.id) setCurrent(null);
              }}
              aria-label={`Remove ${s.name || "this stall"}`}
              className="ml-auto min-h-11 px-3 text-sm text-red-700 underline"
            >
              Remove from list
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => void save()}
        disabled={busy || !dirty}
        className="bg-maroon text-cream min-h-11 px-5 text-sm font-semibold disabled:opacity-45"
      >
        {busy ? "Saving…" : "Save stalls"}
      </button>
      <p className="text-ink/50 text-xs">
        Removing a stall from the list doesn’t delete its bills; they keep the
        stall they were made at.
      </p>
    </section>
  );
}
