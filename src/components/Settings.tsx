"use client";

import { useState } from "react";
import { inr } from "@/lib/money";
import {
  MAX_TEMPLATE,
  PLACEHOLDERS,
  defaultTemplates,
  fullTemplates,
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

        <StallsCard stallList={stallList} sales={sales} className={card} />

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
  const start = fullTemplates(templates.saved);
  const [draft, setDraft] = useState<Required<Templates>>(start);
  const [status, setStatus] = useState("");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<keyof Required<Templates>>("receipt");

  // Adopt what loads from the database, once, unless editing has begun.
  const [adopted, setAdopted] = useState(templates.saved !== null);
  if (!adopted && templates.saved) {
    setAdopted(true);
    setDraft(fullTemplates(templates.saved));
  }

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(fullTemplates(templates.saved));

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
  const preview = (key: keyof Required<Templates>) =>
    render(
      draft[key],
      key === "followUp"
        ? { name: SAMPLE.name }
        : { ...SAMPLE, review: SAMPLE.link },
    );

  return (
    <section className={className}>
      <h3 className="font-display text-maroon text-lg">WhatsApp messages</h3>
      <p className="text-ink/60 text-sm">
        The wording of the messages. Tap a tag to add it where you last typed;
        each is replaced with the real detail when the message is made. A line
        with a {"{link}"} or {"{instagram}"} that has nothing to fill is left
        out.
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
            "reviewAsk",
            "Ask for a review — the button on a bill, sends their review link",
          ],
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
 * books. Exactly one is "current"; every bill made meanwhile is recorded against
 * it and the receipt prints its name, address and phone.
 *
 * Every button here does its job straight away and says so (there is no draft and
 * no separate Save): start a new stall, edit one, make one current, end the
 * current one, delete one. Past stalls stay in the list, with their bills, to look
 * back on in Sales.
 */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function StallsCard({
  stallList,
  sales,
  className,
}: {
  stallList: ReturnType<typeof useStalls>;
  sales: Sale[];
  className: string;
}) {
  const toast = useToast();
  const stalls = stallList.stalls ?? [];
  const current = stalls.find((s) => s.id === stallList.currentId);
  // The stall being created or edited, if the form is open.
  const [form, setForm] = useState<StallEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [removing, setRemoving] = useState<StallEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const tally = (name: string) => {
    const mine = sales.filter((x) => x.stall?.name === name);
    return { bills: mine.length, total: mine.reduce((n, x) => n + x.total, 0) };
  };

  /** Writes the whole list, then tells the user what happened. */
  async function commit(
    next: StallEntry[],
    nextCurrent: string | null,
    done: string,
  ): Promise<boolean> {
    setBusy(true);
    const err = await stallList.save(next, nextCurrent);
    setBusy(false);
    if (err) {
      toast.error(`Not saved: ${err}`);
      return false;
    }
    toast.success(done);
    return true;
  }

  function startNew() {
    const today = todayKey();
    setForm({
      id: crypto.randomUUID().slice(0, 8),
      name: "",
      address: "",
      phone: "",
      from: today,
      to: today,
    });
    setIsNew(true);
    setShowDays(false);
  }

  function edit(s: StallEntry) {
    setForm({ ...s });
    setIsNew(false);
    setShowDays(false);
  }

  async function submit() {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return void toast.error("Give the stall a name.");
    if (
      stalls.some(
        (x) => x.id !== form.id && x.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return void toast.error("Another stall already has that name.");
    const entry = {
      ...form,
      name,
      address: form.address.trim(),
      phone: form.phone.trim(),
    };
    const next = isNew
      ? [entry, ...stalls]
      : stalls.map((x) => (x.id === entry.id ? entry : x));
    const ok = await commit(
      next,
      isNew ? entry.id : stallList.currentId,
      isNew ? `${name} started. New bills go to it.` : "Stall saved.",
    );
    if (ok) setForm(null);
  }

  const field =
    "border-maroon/30 bg-white/70 min-h-11 w-full border px-3 text-base";
  const btn = "min-h-11 border px-4 text-sm font-semibold";
  const outline = `${btn} border-maroon/30 text-maroon hover:bg-petal`;

  return (
    <section className={className}>
      <h3 className="font-display text-maroon text-lg">Stalls</h3>
      <p className="text-ink/60 text-sm">
        Each time the stall happens, start a new one (for example “November 2026
        — Lamakaan”). Bills are recorded against the current stall, and its
        name, address and days are printed on the receipt.
      </p>

      {/* The current stall, front and centre. */}
      {current ? (
        <div className="space-y-2 border border-emerald-700 bg-emerald-50 p-3">
          <div className="text-xs font-semibold tracking-[0.14em] text-emerald-800 uppercase">
            ✓ Current stall
          </div>
          <div className="font-display text-maroon text-xl">{current.name}</div>
          <div className="text-ink/70 text-sm">
            {current.from ? prettyRange(current.from, current.to) : ""}
            {current.address ? ` · ${current.address}` : ""}
          </div>
          <div className="text-ink/60 text-xs">
            {plural(tally(current.name).bills, "bill")} ·{" "}
            {inr(tally(current.name).total)}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => edit(current)} className={outline}>
              Edit
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void commit(
                  stalls,
                  null,
                  "Stall ended. New bills won’t be recorded against any.",
                )
              }
              className={outline}
            >
              End this stall
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-100 p-3 text-sm text-amber-950" role="status">
          {stalls.length > 0
            ? "No stall is current, so new bills aren’t recorded against any. Start a new one, or make a past one current."
            : "No stalls yet. Bills are saved without one, and receipts show the shop address."}
        </div>
      )}

      <button
        onClick={startNew}
        disabled={stalls.length >= 20}
        className={`${btn} bg-maroon border-maroon text-cream disabled:opacity-45`}
      >
        + Start a new stall
      </button>

      {/* Past stalls: each row carries its own actions. */}
      {stalls.filter((x) => x.id !== current?.id).length > 0 && (
        <div>
          <div className="text-olive/80 mb-1 text-xs tracking-[0.18em] uppercase">
            Past stalls
          </div>
          <ul className="divide-maroon/10 border-maroon/15 divide-y border bg-white/50">
            {stalls
              .filter((x) => x.id !== current?.id)
              .map((x) => {
                const t = tally(x.name);
                return (
                  <li
                    key={x.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{x.name}</div>
                      <div className="text-ink/60 text-xs">
                        {x.from ? `${prettyRange(x.from, x.to)} · ` : ""}
                        {plural(t.bills, "bill")} · {inr(t.total)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void commit(
                            stalls,
                            x.id,
                            `${x.name} is now the current stall.`,
                          )
                        }
                        className={outline}
                      >
                        Make current
                      </button>
                      <button onClick={() => edit(x)} className={outline}>
                        Edit
                      </button>
                      <button
                        onClick={() => setRemoving(x)}
                        className="min-h-11 px-2 text-sm text-red-700 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Start / edit form. The days picker stays folded away until asked for. */}
      {form && (
        <Modal
          title={isNew ? "Start a new stall" : "Edit stall"}
          onClose={() => setForm(null)}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-3"
          >
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={60}
              placeholder="Name, e.g. November 2026 — Lamakaan"
              aria-label="Stall name"
              autoFocus
              className={field}
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              maxLength={160}
              placeholder="Venue / address (printed on the receipt)"
              aria-label="Stall address"
              className={field}
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={30}
              placeholder="Phone (optional)"
              aria-label="Stall phone"
              inputMode="tel"
              className={field}
            />
            <div className="border-maroon/15 flex items-center justify-between gap-2 border bg-white/60 p-3">
              <div>
                <div className="text-olive/80 text-xs tracking-[0.14em] uppercase">
                  Days
                </div>
                <div className="text-maroon font-semibold">
                  {form.from ? prettyRange(form.from, form.to) : "Not set"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDays((v) => !v)}
                className={outline}
              >
                {showDays ? "Done" : "Change days"}
              </button>
            </div>
            {showDays && (
              <RangeCalendar
                from={form.from}
                to={form.to}
                onChange={(from, to) => setForm({ ...form, from, to })}
              />
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setForm(null)}
                className={outline}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !form.name.trim()}
                className="bg-maroon text-cream min-h-11 px-4 text-sm font-semibold disabled:opacity-45"
              >
                {busy ? "Saving…" : isNew ? "Start stall" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Deleting asks first. */}
      {removing && (
        <Modal title="Delete this stall?" onClose={() => setRemoving(null)}>
          <p className="text-sm">
            <strong>{removing.name}</strong> will be removed from the list. Its{" "}
            {plural(tally(removing.name).bills, "bill")}{" "}
            {tally(removing.name).bills === 1 ? "is" : "are"} not deleted; they
            keep the stall they were made at.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setRemoving(null)} className={outline}>
              Keep it
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                const gone = removing;
                const ok = await commit(
                  stalls.filter((x) => x.id !== gone.id),
                  stallList.currentId === gone.id ? null : stallList.currentId,
                  `${gone.name} deleted.`,
                );
                if (ok) setRemoving(null);
              }}
              className="min-h-11 bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
            >
              Delete stall
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
