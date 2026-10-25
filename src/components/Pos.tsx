"use client";

import Settings from "./Settings";
import { useTemplates } from "./useTemplates";
import { useUpiQr } from "./useUpiQr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BUSINESS } from "@/lib/config";
import type { Sale } from "@/lib/types";
import ManageItems from "./ManageItems";
import ReceiptSheet from "./ReceiptSheet";
import Register from "./Register";
import Sales from "./Sales";
import { ToastProvider, useToast } from "./Toasts";
import { useCatalog } from "./useCatalog";
import { useStalls } from "./useStalls";
import { useSales, type SaveResult } from "./useSales";

function Gate({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-cream grid h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-maroon text-3xl">{title}</h1>
        <div className="text-ink/70 mt-4 space-y-4 text-base leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

const gateButton =
  "bg-maroon text-cream hover:bg-maroon-deep inline-flex min-h-12 items-center px-6 font-semibold";

/** The till, with its toasts. */
export default function Pos() {
  return (
    <ToastProvider>
      <PosScreen />
    </ToastProvider>
  );
}

function PosScreen() {
  const router = useRouter();
  const toast = useToast();
  const { sales, conn, refresh, save, clear } = useSales();
  const items = useCatalog();
  const qr = useUpiQr();
  const templates = useTemplates();
  const stallList = useStalls();
  const [view, setView] = useState<"register" | "sales" | "items" | "settings">(
    "register",
  );
  /** Bumped after each sale: remounting is the whole "clear the till" logic. */
  const [till, setTill] = useState(0);
  const [receipt, setReceipt] = useState<{ sale: Sale; fresh: boolean } | null>(
    null,
  );

  /** A receipt exists only for a sale the database has confirmed. */
  async function onSave(sale: Sale): Promise<SaveResult> {
    const result = await save(sale);
    if (result.status === "saved") {
      setReceipt({ sale: result.sale, fresh: true });
      toast.success(`Sale saved · ${result.sale.invoiceNo}`);
    } else {
      toast.error(`Sale not saved: ${result.message}`);
    }
    return result;
  }

  // Say so when the cloud is lost, and when it is back.
  const lastConn = useRef(conn);
  useEffect(() => {
    const was = lastConn.current;
    lastConn.current = conn;
    if (conn === "down" && was !== "down")
      toast.error("Can’t reach the cloud. Nothing is saved until it’s back.");
    else if (conn === "ok" && was === "down") toast.success("Back online.");
    else if (conn === "signedOut" && was !== "signedOut")
      toast.warning("You’ve been signed out. Sign in again to keep selling.");
  }, [conn, toast]);

  // The item list is saved as it is edited; a failure must not go unnoticed.
  const saveKind = items.save.kind;
  const lastSave = useRef(saveKind);
  useEffect(() => {
    if (saveKind === "failed" && lastSave.current !== "failed")
      toast.error(
        "The item list wasn’t saved. Check the connection and retry.",
      );
    lastSave.current = saveKind;
  }, [saveKind, toast]);

  /**
   * After a failure that may have reached the server, ask it. If the sale is
   * there, that is the answer and the receipt opens; only if it is certainly
   * not there is it safe to let the bill be changed and sent again.
   */
  async function onCheck(sale: Sale): Promise<"saved" | "missing" | "unknown"> {
    const list = await refresh();
    if (!list) return "unknown";
    const stored = list.find((s) => s.id === sale.id);
    if (stored) {
      setReceipt({ sale: stored, fresh: true });
      return "saved";
    }
    return "missing";
  }

  function closeReceipt() {
    if (receipt?.fresh) setTill((n) => n + 1);
    setReceipt(null);
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (items.phase === "loading") {
    return (
      <div className="bg-cream text-maroon/60 grid h-dvh place-items-center text-sm tracking-[0.2em] uppercase">
        Opening the till…
      </div>
    );
  }
  if (items.phase === "notSetUp") {
    return (
      <Gate title="Cloud storage isn’t set up">
        <p>
          This till keeps everything in the database and nothing on the iPad, so
          it can’t open without one.
        </p>
        <p className="text-sm">
          Set <code>SUPABASE_URL</code> and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> for this deployment, run the
          files in <code>supabase/migrations</code>, then redeploy.
        </p>
      </Gate>
    );
  }
  if (items.phase === "signedOut") {
    return (
      <Gate title="Signed out">
        <a href="/login" className={gateButton}>
          Sign in again
        </a>
      </Gate>
    );
  }
  if (items.phase === "unreachable" || !items.catalog) {
    return (
      <Gate title="Can’t reach the cloud">
        <p>
          Check the Wi-Fi or the hotspot. Nothing is stored on this iPad, so the
          till waits for a connection.
        </p>
        <button onClick={() => void items.reload()} className={gateButton}>
          Try again
        </button>
      </Gate>
    );
  }

  const stall = (stallList.stalls ?? []).find(
    (x) => x.id === stallList.currentId,
  );

  const status =
    conn === "signedOut"
      ? { warn: true, text: "Signed out" }
      : conn === "down"
        ? { warn: true, text: "Can’t reach the cloud" }
        : items.save.kind === "failed"
          ? { warn: true, text: "Item list not saved · tap to retry" }
          : items.save.kind === "saving"
            ? { warn: false, text: "Saving…" }
            : { warn: false, text: "Connected" };

  const nav = (on: boolean) =>
    `inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm transition-colors sm:flex-none sm:px-5 ${
      on ? "bg-petal text-maroon-deep" : "text-petal/80 hover:text-petal"
    }`;

  return (
    <div className="bg-cream text-ink fixed inset-0 flex flex-col overflow-clip">
      <header className="bg-maroon-deep text-petal flex flex-wrap items-center justify-between gap-x-3 px-3 py-1 sm:flex-nowrap sm:px-4 sm:py-2">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className="size-9" />
          <span className="font-display text-base tracking-wide sm:text-lg">
            {BUSINESS.name}
          </span>
          {stall ? (
            <button
              onClick={() => setView("settings")}
              className="text-petal/80 hover:text-petal max-w-40 truncate text-xs tracking-[0.12em] uppercase underline-offset-4 hover:underline"
              title="Current stall — tap to change in Settings"
            >
              {stall.name}
            </button>
          ) : (stallList.stalls?.length ?? 0) > 0 ? (
            <button
              onClick={() => setView("settings")}
              className="max-w-40 truncate bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950"
              title="Bills aren’t being recorded against any stall"
            >
              No stall started
            </button>
          ) : (
            <span className="text-petal/60 hidden text-xs tracking-[0.2em] uppercase sm:inline">
              Stall
            </span>
          )}
        </div>

        <nav
          className="order-last flex w-full sm:order-none sm:w-auto"
          aria-label="Sections"
        >
          <button
            onClick={() => setView("register")}
            className={nav(view === "register")}
          >
            Register
          </button>
          <button
            onClick={() => {
              setView("sales");
              void refresh();
            }}
            className={nav(view === "sales")}
          >
            Sales
          </button>
          <button
            onClick={() => setView("items")}
            className={nav(view === "items")}
          >
            Items
          </button>
          <button
            onClick={() => setView("settings")}
            className={nav(view === "settings")}
          >
            Settings
          </button>
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={() =>
              items.save.kind === "failed" ? items.retry() : void refresh()
            }
            className={`inline-flex min-h-11 items-center gap-2 text-xs ${status.warn ? "text-blush" : "text-petal/70"}`}
            aria-label={`${status.text}. Tap to check again.`}
          >
            <span
              className={`size-2 rounded-full ${status.warn ? "bg-blush" : "bg-sage"}`}
              aria-hidden="true"
            />
            <span className={status.warn ? "" : "hidden sm:inline"}>
              {status.text}
            </span>
          </button>
          <button
            onClick={signOut}
            className="text-petal/60 hover:text-petal min-h-11 px-1 text-xs"
          >
            Sign out
          </button>
        </div>
      </header>

      {conn === "signedOut" && (
        <div
          role="alert"
          className="bg-blush/40 text-maroon-deep px-4 py-2 text-center text-sm"
        >
          Your session ended.{" "}
          <a href="/login" className="font-semibold underline">
            Sign in again
          </a>{" "}
          before ringing up anything else; a sale can’t be saved while signed
          out.
        </div>
      )}

      {/* The register stays mounted and is only hidden. Unmounting it threw away
          a half-built bill the moment someone looked at Sales or fixed a price,
          and the bill is exactly what must survive a glance elsewhere. */}
      <div
        className={`${view === "register" ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}
      >
        <Register
          key={till}
          catalog={items.catalog}
          qr={qr.image}
          stall={
            stall
              ? {
                  name: stall.name,
                  address: stall.address,
                  phone: stall.phone,
                  from: stall.from,
                  to: stall.to,
                }
              : undefined
          }
          onSave={onSave}
          onCheck={onCheck}
        />
      </div>
      {view === "sales" && (
        <Sales
          sales={sales}
          templates={templates.saved}
          currentStall={stall?.name}
          onOpen={(sale) => setReceipt({ sale, fresh: false })}
        />
      )}
      {view === "items" && (
        <ManageItems
          catalog={items.catalog}
          status={items.save}
          onChange={items.update}
          onRetry={items.retry}
        />
      )}
      {view === "settings" && (
        <Settings
          qr={qr}
          stallList={stallList}
          templates={templates}
          sales={sales}
          onWiped={clear}
          onRestored={() => void refresh()}
        />
      )}

      {receipt && (
        <ReceiptSheet
          key={receipt.sale.id}
          sale={receipt.sale}
          fresh={receipt.fresh}
          templates={templates.saved}
          onClose={closeReceipt}
        />
      )}
    </div>
  );
}
