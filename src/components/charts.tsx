"use client";

import { useEffect, useRef, useState } from "react";
import { inr, inrCompact, shareText } from "@/lib/money";

/**
 * Charts for Products & money, drawn as plain SVG: no chart library to download.
 * Each one measures the width it is given and lays itself out for that width, so
 * the text stays a readable size on a phone instead of shrinking with the picture.
 *
 * Every shape carries a <title> (its tooltip, and what a screen reader reads) with
 * the exact figure, and each chart has an aria-label that sums it up.
 */
export const PALETTE = [
  "#762136",
  "#f49b49",
  "#b0541a",
  "#c4566e",
  "#7d3a10",
  "#a88a6a",
  "#e3c3a0",
];
const INK = "#261a1c";
const MUTED = "rgba(38, 26, 28, 0.55)";
const FAINT = "rgba(38, 26, 28, 0.12)";
const LOSS = "#c0392b";
const MAROON = "#762136";

/** The width of the box a chart sits in, kept up to date as the screen changes. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setW(Math.round(entries[0].contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

/** A round-numbered top for an axis, and ticks up to it. */
function niceAxis(max: number, ticks = 4) {
  const raw = Math.max(max, 1) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  return { top: step * ticks, step, ticks };
}

export function ChartCard({
  title,
  note,
  children,
  wide = false,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`border-maroon/15 space-y-2 border bg-white/50 p-4 ${wide ? "md:col-span-2" : ""}`}
    >
      <div>
        <h3 className="font-display text-maroon text-lg">{title}</h3>
        {note && <p className="text-ink/50 text-xs">{note}</p>}
      </div>
      {children}
    </section>
  );
}

type Product = {
  key: string;
  name: string;
  net: number;
  gross: number;
  offer: number;
  pieces: number;
  klass: "A" | "B" | "C";
};

/* ── 1. Where takings come from (Pareto) ─────────────────────────────────── */

/** The index of the row where the running total first reaches 80%, or -1. */
function cutAt(rows: { net: number }[], total: number): number {
  let run = 0;
  for (let i = 0; i < rows.length; i++) {
    run += rows[i].net;
    if (total && (run / total) * 100 >= 80) return i;
  }
  return -1;
}

export function ParetoChart({
  products,
  total,
}: {
  products: Product[];
  total: number;
}) {
  const [ref, width] = useWidth();
  const w = width || 320;
  // The biggest dozen get a row each; the rest are rolled into one.
  const sorted = [...products].sort((a, b) => b.net - a.net);
  const shown = sorted.slice(0, 12);
  const rest = sorted.slice(12);
  const rows = rest.length
    ? [
        ...shown,
        {
          key: "_rest",
          name: `${rest.length} others`,
          net: rest.reduce((n, r) => n + r.net, 0),
          klass: "C" as const,
        },
      ]
    : shown;
  const rowH = 30;
  const labelW = Math.min(150, Math.round(w * 0.36));
  const rightW = 44;
  const barX = labelW + 8;
  // Room after the longest bar for its value, so it never runs into the % column.
  const valW = w >= 420 ? 54 : 0;
  const barMax = Math.max(w - barX - rightW - valW - 8, 40);
  const maxNet = Math.max(...rows.map((r) => r.net), 1);
  const hasCut =
    cutAt(rows, total) >= 0 && cutAt(rows, total) < rows.length - 1;
  const gap = hasCut ? 20 : 0;
  const height = rows.length * rowH + 8 + gap;
  // The running total after each row, and the row where it first reaches 80%.
  const cums = rows.map((_, i) =>
    total
      ? (rows.slice(0, i + 1).reduce((n, r) => n + r.net, 0) / total) * 100
      : 0,
  );
  const cutAfter = cums.findIndex((p) => p >= 80);

  return (
    <div ref={ref}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={`Takings by product, biggest first. The top ${cutAfter + 1} bring ${Math.round(cums[Math.max(cutAfter, 0)] ?? 0)}% of takings.`}
      >
        {rows.map((r, i) => {
          const y = i * rowH + 4 + (hasCut && i > cutAfter ? gap : 0);
          const len = Math.max((r.net / maxNet) * barMax, r.net > 0 ? 2 : 0);
          const fill =
            r.klass === "A"
              ? MAROON
              : r.klass === "B"
                ? "rgba(118,33,54,0.55)"
                : "rgba(38,26,28,0.30)";
          return (
            <g key={r.key}>
              <title>{`${r.name}: ${inr(r.net)} (${shareText(r.net, total)} of takings). Running total ${Math.round(cums[i])}%.`}</title>
              <text
                x={labelW}
                y={y + 16}
                textAnchor="end"
                fontSize="12"
                fill={INK}
              >
                {clip(r.name, Math.max(Math.floor(labelW / 6.5), 8))}
              </text>
              <rect x={barX} y={y + 4} width={len} height={16} fill={fill} />
              <text x={barX + len + 6} y={y + 16} fontSize="11" fill={MUTED}>
                {w >= 420 ? inrCompact(r.net) : ""}
              </text>
              <text
                x={w - 2}
                y={y + 16}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill={i <= cutAfter ? MAROON : MUTED}
              >
                {Math.round(cums[i])}%
              </text>
            </g>
          );
        })}
        {cutAfter >= 0 && cutAfter < rows.length - 1 && (
          <g>
            <line
              x1={0}
              x2={w}
              y1={(cutAfter + 1) * rowH + 4 + 3}
              y2={(cutAfter + 1) * rowH + 4 + 3}
              stroke={LOSS}
              strokeDasharray="4 3"
            />
            <text
              x={barX}
              y={(cutAfter + 1) * rowH + 4 + 3 + 13}
              textAnchor="start"
              fontSize="10"
              fill={LOSS}
            >
              80% of takings above this line
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ── 2. Money given away (net vs offers) ─────────────────────────────────── */

export function OffersChart({ products }: { products: Product[] }) {
  const [ref, width] = useWidth();
  const w = width || 320;
  const top = [...products].sort((a, b) => b.gross - a.gross).slice(0, 8);
  const rowH = 30;
  const labelW = Math.min(130, Math.round(w * 0.34));
  const rightW = w >= 380 ? 92 : 56;
  const barX = labelW + 8;
  const barMax = Math.max(w - barX - rightW - 4, 40);
  const maxGross = Math.max(...top.map((r) => r.gross), 1);
  const given = products.reduce((n, r) => n + r.offer, 0);
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={top.length * rowH + 8}
        role="img"
        aria-label={`Each product's takings and the offers given on it. ${inr(given)} in offers in all.`}
      >
        {top.map((r, i) => {
          const y = i * rowH + 4;
          const netLen = (r.net / maxGross) * barMax;
          const offLen = (r.offer / maxGross) * barMax;
          return (
            <g key={r.key}>
              <title>{`${r.name}: ${inr(r.gross)} before offers = ${inr(r.net)} kept + ${inr(r.offer)} given away (${shareText(r.offer, r.gross)}).`}</title>
              <text
                x={labelW}
                y={y + 16}
                textAnchor="end"
                fontSize="12"
                fill={INK}
              >
                {clip(r.name, Math.max(Math.floor(labelW / 6.5), 8))}
              </text>
              <rect
                x={barX}
                y={y + 4}
                width={netLen}
                height={16}
                fill={MAROON}
              />
              <rect
                x={barX + netLen}
                y={y + 4}
                width={offLen}
                height={16}
                fill={LOSS}
              />
              <text
                x={w - 2}
                y={y + 16}
                textAnchor="end"
                fontSize="11"
                fill={r.offer > 0 ? LOSS : MUTED}
              >
                {r.offer > 0
                  ? `−${inrCompact(r.offer)}${w >= 380 ? ` · ${shareText(r.offer, r.gross)}` : ""}`
                  : "—"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-ink/55 mt-1 flex gap-4 text-xs">
        <span>
          <i
            className="mr-1 inline-block size-2.5 align-middle"
            style={{ background: MAROON }}
          />
          kept
        </span>
        <span>
          <i
            className="mr-1 inline-block size-2.5 align-middle"
            style={{ background: LOSS }}
          />
          given away
        </span>
      </div>
    </div>
  );
}

/* ── 3. Category donut ───────────────────────────────────────────────────── */

export function CategoryDonut({
  categories,
  total,
}: {
  categories: { name: string; net: number }[];
  total: number;
}) {
  const [ref, width] = useWidth();
  const w = width || 300;
  const size = Math.min(Math.max(w, 160), 220);
  const r = size / 2 - 22;
  const c = 2 * Math.PI * r;
  // Where each slice starts: the total of the slices before it.
  const offsets = categories.map((_, i) =>
    categories
      .slice(0, i)
      .reduce((n, x) => n + (total ? (x.net / total) * c : 0), 0),
  );
  return (
    <div
      ref={ref}
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
    >
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Takings by category: ${categories.map((x) => `${x.name} ${shareText(x.net, total)}`).join(", ")}.`}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={FAINT}
            strokeWidth={26}
          />
          {categories.map((x, i) => {
            const len = total ? (x.net / total) * c : 0;
            return (
              <circle
                key={x.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={26}
                strokeDasharray={`${Math.max(len - 1, 0)} ${c - Math.max(len - 1, 0)}`}
                strokeDashoffset={-offsets[i]}
              >
                <title>{`${x.name}: ${inr(x.net)} (${shareText(x.net, total)})`}</title>
              </circle>
            );
          })}
        </g>
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fontSize="11"
          fill={MUTED}
        >
          takings
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          fontSize="16"
          fontWeight="600"
          fill={MAROON}
        >
          {inrCompact(total)}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {categories.map((x, i) => (
          <li key={x.name} className="num flex items-center gap-2">
            <i
              className="inline-block size-3 shrink-0"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="min-w-0 flex-1">{x.name}</span>
            <span className="text-ink/55">{shareText(x.net, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 4. Price vs volume (bubbles) ────────────────────────────────────────── */

export function PriceVolumeChart({ products }: { products: Product[] }) {
  const [ref, width] = useWidth();
  const w = width || 320;
  const h = w >= 520 ? 300 : 260;
  const padL = 40,
    padR = 12,
    padT = 14,
    padB = 34;
  const pts = products.map((p) => ({ ...p, avg: p.net / p.pieces }));
  const maxX = niceAxis(Math.max(...pts.map((p) => p.avg), 1) * 1.1);
  const maxY = niceAxis(Math.max(...pts.map((p) => p.pieces), 1) * 1.15, 4);
  const maxNet = Math.max(...pts.map((p) => p.net), 1);
  const x = (v: number) => padL + (v / maxX.top) * (w - padL - padR);
  const y = (v: number) => h - padB - (v / maxY.top) * (h - padT - padB);
  const totalPieces = pts.reduce((n, p) => n + p.pieces, 0);
  const totalNet = pts.reduce((n, p) => n + p.net, 0);
  const avgPrice = totalPieces ? totalNet / totalPieces : 0;
  const avgPieces = pts.length ? totalPieces / pts.length : 0;
  const radius = (net: number) => 6 + 20 * Math.sqrt(net / maxNet);
  // Label the biggest earners, but skip any label that would sit on top of one
  // already placed.
  const labelled = (() => {
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const keep = new Set<string>();
    for (const p of [...pts]
      .sort((a, b) => b.net - a.net)
      .slice(0, w >= 520 ? 8 : 4)) {
      const half = (clip(p.name, 16).length * 6) / 2;
      const cy = y(p.pieces) - radius(p.net) - 4;
      const box = {
        l: x(p.avg) - half,
        r: x(p.avg) + half,
        t: cy - 11,
        b: cy + 2,
      };
      if (
        placed.some(
          (q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t,
        )
      )
        continue;
      placed.push(box);
      keep.add(p.key);
    }
    return keep;
  })();
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label="Each product by its average price and the pieces sold; bigger bubbles earned more."
      >
        {Array.from({ length: maxY.ticks + 1 }, (_, i) => i * maxY.step).map(
          (v) => (
            <g key={`y${v}`}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y(v)}
                y2={y(v)}
                stroke={FAINT}
              />
              <text
                x={padL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="10"
                fill={MUTED}
              >
                {v}
              </text>
            </g>
          ),
        )}
        {Array.from({ length: maxX.ticks + 1 }, (_, i) => i * maxX.step).map(
          (v) => (
            <text
              key={`x${v}`}
              x={x(v)}
              y={h - padB + 15}
              textAnchor={x(v) > w - 28 ? "end" : "middle"}
              fontSize="10"
              fill={MUTED}
            >
              {inrCompact(v)}
            </text>
          ),
        )}
        <text
          x={(padL + w - padR) / 2}
          y={h - 4}
          textAnchor="middle"
          fontSize="10"
          fill={MUTED}
        >
          average price per piece →
        </text>

        {/* The shop's own averages split the chart into four kinds of product. */}
        <line
          x1={x(avgPrice)}
          x2={x(avgPrice)}
          y1={padT}
          y2={h - padB}
          stroke={MUTED}
          strokeDasharray="3 3"
        />
        <line
          x1={padL}
          x2={w - padR}
          y1={y(avgPieces)}
          y2={y(avgPieces)}
          stroke={MUTED}
          strokeDasharray="3 3"
        />
        <text x={padL + 4} y={padT + 10} fontSize="10" fill={MUTED}>
          cheap · popular
        </text>
        <text
          x={w - padR - 4}
          y={padT + 10}
          textAnchor="end"
          fontSize="10"
          fill={MUTED}
        >
          pricey · popular
        </text>
        <text x={padL + 4} y={h - padB - 6} fontSize="10" fill={MUTED}>
          cheap · slow
        </text>
        <text
          x={w - padR - 4}
          y={h - padB - 6}
          textAnchor="end"
          fontSize="10"
          fill={MUTED}
        >
          pricey · slow
        </text>
        {pts.map((p) => {
          const rad = radius(p.net);
          return (
            <g key={p.key}>
              <title>{`${p.name}: ${p.pieces} pieces at about ${inr(Math.round(p.avg))} each, ${inr(p.net)} in all.`}</title>
              <circle
                cx={x(p.avg)}
                cy={y(p.pieces)}
                r={rad}
                fill={MAROON}
                fillOpacity={0.55}
                stroke={MAROON}
              />
              {labelled.has(p.key) && (
                <text
                  x={x(p.avg)}
                  y={y(p.pieces) - rad - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill={INK}
                >
                  {clip(p.name, 16)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-ink/45 text-xs">
        Higher = more pieces sold, further right = higher average price, bigger
        bubble = more money earned. Dashed lines are your averages.
      </p>
    </div>
  );
}

/* ── 5. Takings by day, stacked by category ──────────────────────────────── */

export function DailyChart({
  days,
  categories,
}: {
  days: { day: string; label: string; segs: Map<string, number> }[];
  categories: string[];
}) {
  const [ref, width] = useWidth();
  const w = width || 320;
  const h = 240;
  const padL = 46,
    padR = 8,
    padT = 10,
    padB = 30;
  const shown = days.slice(-31);
  const totals = shown.map((d) =>
    [...d.segs.values()].reduce((n, v) => n + v, 0),
  );
  const axis = niceAxis(Math.max(...totals, 1), 4);
  const slot = (w - padL - padR) / Math.max(shown.length, 1);
  const bw = Math.min(Math.max(slot * 0.62, 6), 56);
  const y = (v: number) => h - padB - (v / axis.top) * (h - padT - padB);
  const labelEvery = Math.ceil(
    shown.length / Math.max(Math.floor((w - padL) / 52), 1),
  );
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`Takings for each day, split by category. ${shown.length} day${shown.length === 1 ? "" : "s"}.`}
      >
        {Array.from({ length: axis.ticks + 1 }, (_, i) => i * axis.step).map(
          (v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y(v)}
                y2={y(v)}
                stroke={FAINT}
              />
              <text
                x={padL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="10"
                fill={MUTED}
              >
                {inrCompact(v)}
              </text>
            </g>
          ),
        )}
        {shown.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          let acc = 0;
          return (
            <g key={d.day}>
              {categories.map((cat, ci) => {
                const v = d.segs.get(cat) ?? 0;
                if (!v) return null;
                const top = y(acc + v);
                const hh = y(acc) - top;
                acc += v;
                return (
                  <rect
                    key={cat}
                    x={cx - bw / 2}
                    y={top}
                    width={bw}
                    height={Math.max(hh - 0.5, 0)}
                    fill={PALETTE[ci % PALETTE.length]}
                  >
                    <title>{`${d.label} · ${cat}: ${inr(v)}`}</title>
                  </rect>
                );
              })}
              {i % labelEvery === 0 && (
                <text
                  x={cx}
                  y={h - padB + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill={MUTED}
                >
                  {d.label}
                </text>
              )}
              <text
                x={cx}
                y={y(acc) - 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={MAROON}
              >
                {bw >= 22 ? inrCompact(totals[i]) : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="text-ink/60 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {categories.map((c, i) => (
          <li key={c}>
            <i
              className="mr-1 inline-block size-2.5 align-middle"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

const GAIN = "#1f7a4d";
const ORANGE = "#f49b49";

/**
 * Takings against costs, one row per stall. The profit (or loss) is written at
 * the end of the row in green or red; with no costs entered, only takings show.
 */
export function StallMoneyChart({
  stalls,
}: {
  stalls: {
    name: string;
    takings: number;
    costs: number;
    profit: number | null;
  }[];
}) {
  const [ref, width] = useWidth();
  const w = width || 320;
  const rowH = 46;
  const padT = 4;
  const labelW = Math.min(Math.max(Math.round(w * 0.26), 72), 150);
  const rightW = 74;
  const plotW = Math.max(w - labelW - rightW - 60, 40);
  const max = Math.max(...stalls.flatMap((s) => [s.takings, s.costs]), 1);
  const x = (v: number) => (v / max) * plotW;
  const h = padT + rowH * stalls.length;
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`Takings and costs for each of ${stalls.length} stalls.`}
      >
        {stalls.map((s, i) => {
          const y = padT + rowH * i;
          return (
            <g key={s.name}>
              <text x={0} y={y + 22} fontSize="12" fill={INK}>
                {clip(s.name, Math.floor(labelW / 7))}
                <title>{s.name}</title>
              </text>
              <rect
                x={labelW}
                y={y + 8}
                width={Math.max(x(s.takings), 1)}
                height={13}
                fill={MAROON}
              >
                <title>{`${s.name} · takings ${inr(s.takings)}`}</title>
              </rect>
              <text
                x={labelW + x(s.takings) + 5}
                y={y + 19}
                fontSize="10"
                fill={MUTED}
              >
                {inrCompact(s.takings)}
              </text>
              {s.costs > 0 && (
                <>
                  <rect
                    x={labelW}
                    y={y + 24}
                    width={Math.max(x(s.costs), 1)}
                    height={13}
                    fill={ORANGE}
                  >
                    <title>{`${s.name} · costs ${inr(s.costs)}`}</title>
                  </rect>
                  <text
                    x={labelW + x(s.costs) + 5}
                    y={y + 35}
                    fontSize="10"
                    fill={MUTED}
                  >
                    {inrCompact(s.costs)}
                  </text>
                </>
              )}
              {s.profit !== null && (
                <text
                  x={w}
                  y={y + 27}
                  textAnchor="end"
                  fontSize="13"
                  fontWeight="700"
                  fill={s.profit < 0 ? LOSS : GAIN}
                >
                  {s.profit < 0 ? "−" : "+"}
                  {inrCompact(Math.abs(s.profit))}
                </text>
              )}
              <line
                x1={0}
                x2={w}
                y1={y + rowH - 1}
                y2={y + rowH - 1}
                stroke={FAINT}
              />
            </g>
          );
        })}
      </svg>
      <ul className="text-ink/60 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li>
          <i className="mr-1 inline-block size-2.5 align-middle bg-[#762136]" />
          Takings
        </li>
        <li>
          <i className="mr-1 inline-block size-2.5 align-middle bg-[#f49b49]" />
          Costs (goods and stall)
        </li>
        <li>
          <span className="text-gain font-semibold">+ profit</span> /{" "}
          <span className="text-loss font-semibold">− loss</span>
        </li>
      </ul>
    </div>
  );
}

/** A line through one figure per stall, oldest to newest. */
export function LineTrend({
  points,
  format = inrCompact,
  label,
}: {
  points: { label: string; value: number }[];
  format?: (n: number) => string;
  /** What the line is, for screen readers. */
  label: string;
}) {
  const [ref, width] = useWidth();
  const w = width || 320;
  const h = 190;
  const padL = 46,
    padR = 16,
    padT = 16,
    padB = 30;
  const axis = niceAxis(Math.max(...points.map((p) => p.value), 1), 4);
  const n = points.length;
  // The first and last points sit inset from the edges, so their labels have room
  // and the first one stays clear of the axis figures.
  const inset = 30;
  const x = (i: number) =>
    n === 1
      ? (padL + w - padR) / 2
      : padL + inset + ((w - padL - padR - 2 * inset) * i) / (n - 1);
  const y = (v: number) => h - padB - (v / axis.top) * (h - padT - padB);
  const every = Math.ceil(n / Math.max(Math.floor((w - padL) / 70), 1));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`${label}, for ${n} stall${n === 1 ? "" : "s"}.`}
      >
        {Array.from({ length: axis.ticks + 1 }, (_, i) => i * axis.step).map(
          (v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y(v)}
                y2={y(v)}
                stroke={FAINT}
              />
              <text
                x={padL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="10"
                fill={MUTED}
              >
                {inrCompact(v)}
              </text>
            </g>
          ),
        )}
        {n > 1 && <path d={path} fill="none" stroke={MAROON} strokeWidth="2" />}
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill={MAROON}>
              <title>{`${p.label}: ${format(p.value)}`}</title>
            </circle>
            {(i === n - 1 || n <= 6) && (
              <text
                x={x(i)}
                y={y(p.value) - 9}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={MAROON}
              >
                {format(p.value)}
              </text>
            )}
            {i % every === 0 && (
              <text
                x={x(i)}
                y={h - padB + 15}
                textAnchor="middle"
                fontSize="10"
                fill={MUTED}
              >
                {clip(p.label, 12)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** A tiny line of pieces sold per day at each stall, for a table cell. */
export function Spark({
  values,
  tone,
}: {
  values: number[];
  tone: "up" | "down" | "flat";
}) {
  const w = 76;
  const h = 24;
  const max = Math.max(...values, 1);
  const x = (i: number) =>
    values.length === 1 ? w / 2 : (w * i) / (values.length - 1);
  const y = (v: number) => h - 3 - (v / max) * (h - 6);
  const color = tone === "up" ? GAIN : tone === "down" ? LOSS : MUTED;
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path
        d={values
          .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1])}
        r="2.4"
        fill={color}
      />
    </svg>
  );
}
