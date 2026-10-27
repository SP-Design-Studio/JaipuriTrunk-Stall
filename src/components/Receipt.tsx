import { forwardRef } from "react";
import { BUSINESS, PROMO } from "@/lib/config";
import { describeDiscount, inr, lineTotal, variantOf } from "@/lib/money";
import { prettyDate, prettyRange, prettyTime } from "@/lib/time";
import type { Sale } from "@/lib/types";

/**
 * The receipt, drawn to be photographed.
 *
 * It is turned into a PNG by html2canvas, which cannot parse the modern colour
 * functions Tailwind v4 emits — `oklch()` for the palette utilities, and
 * `color-mix()` for every `/70`-style opacity modifier. Either makes the capture
 * throw. So this component uses plain hex and rgba inline styles and no colour
 * utilities, which is also why it looks hand-set: it is the one part of the app
 * that has to survive being rasterised rather than rendered.
 */
const C = {
  paper: "#fdf6ea",
  ink: "#241a1d",
  soft: "rgba(36, 26, 29, 0.62)",
  faint: "rgba(36, 26, 29, 0.42)",
  rule: "rgba(36, 26, 29, 0.18)",
  maroon: "#762136",
  olive: "#b0541a",
  tint: "#f9e6d6",
};

/**
 * The torn edge: a row of small teeth, as if the slip was ripped off a printer's
 * tear bar. Drawn as a tiny SVG image (html2canvas can capture an <img>, but not
 * clip-path or masks, which are the usual ways to cut a shape out of a box).
 * The area outside the teeth is transparent, so the page shows through.
 */
const TOOTH = 15;
const TOOTH_H = 9;
const teeth = (up: boolean) => {
  const pts: string[] = [];
  for (let x = 0; x < 360; x += TOOTH) {
    pts.push(
      `${x},${up ? TOOTH_H : 0}`,
      `${x + TOOTH / 2},${up ? 0 : TOOTH_H}`,
    );
  }
  pts.push(`360,${up ? TOOTH_H : 0}`);
  const line = pts.join(" ");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${TOOTH_H}" viewBox="0 0 360 ${TOOTH_H}">` +
    `<polygon points="${line}" fill="${C.paper}"/>` +
    `<polyline points="${line}" fill="none" stroke="rgba(36,26,29,0.22)" stroke-width="1"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
const TEETH_TOP = teeth(true);
const TEETH_BOTTOM = teeth(false);

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};
const small = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: C.faint,
  ...extra,
});

const Receipt = forwardRef<
  HTMLDivElement,
  {
    sale: Sale;
    /** False on the public page: a link anyone could open shows no name. */
    showCustomer?: boolean;
  }
>(function Receipt({ sale, showCustomer = true }, ref) {
  const discountLabel = describeDiscount(sale.discount);
  return (
    <div
      ref={ref}
      style={{
        width: 360,
        color: C.ink,
        fontFamily: "var(--font-body)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TEETH_TOP}
        alt=""
        width={360}
        height={TOOTH_H}
        style={{ display: "block" }}
      />
      <div
        style={{
          boxSizing: "border-box",
          padding: "20px 26px 18px",
          background: C.paper,
          borderLeft: `1px solid ${C.rule}`,
          borderRight: `1px solid ${C.rule}`,
        }}
      >
        <div
          style={{
            textAlign: "center",
            paddingBottom: 16,
            borderBottom: `1px solid ${C.rule}`,
          }}
        >
          {/* The key-and-trunk monogram over the name, both in black so the receipt
            prints and photocopies cleanly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/monogram-black.png"
            alt=""
            width={60}
            height={81}
            style={{
              display: "block",
              margin: "0 auto",
              width: 60,
              height: "auto",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/wordmark-black.png"
            alt={BUSINESS.name}
            width={260}
            height={32}
            style={{
              display: "block",
              margin: "10px auto 0",
              width: 260,
              height: "auto",
            }}
          />
          <div style={small({ marginTop: 12 })}>{BUSINESS.tagline}</div>
          {/* Which stall this was bought at, when the till knows. */}
          {sale.stall && (
            <div
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: C.ink,
              }}
            >
              {sale.stall.name}
            </div>
          )}
          {sale.stall?.from && (
            <div style={{ fontSize: 12, color: C.soft }}>
              {prettyRange(sale.stall.from, sale.stall.to)}
            </div>
          )}
          {(sale.stall?.address || (!sale.stall && BUSINESS.address)) && (
            <div
              style={{
                marginTop: sale.stall ? 2 : 8,
                fontSize: 12,
                color: C.soft,
                lineHeight: 1.5,
              }}
            >
              {sale.stall ? sale.stall.address : BUSINESS.address}
            </div>
          )}
          {(sale.stall?.phone || (!sale.stall && BUSINESS.phone)) && (
            <div style={{ fontSize: 12, color: C.soft }}>
              {sale.stall ? sale.stall.phone : BUSINESS.phone}
            </div>
          )}
          {BUSINESS.gstin && (
            <div
              style={{ fontSize: 12, color: C.soft, letterSpacing: "0.06em" }}
            >
              GSTIN {BUSINESS.gstin}
            </div>
          )}
        </div>

        <div
          style={{
            ...row,
            padding: "14px 0",
            fontSize: 12,
            borderBottom: `1px dashed ${C.rule}`,
          }}
        >
          <div style={{ lineHeight: 1.6 }}>
            <div>
              <span style={{ color: C.faint }}>Receipt </span>
              <strong>{sale.invoiceNo}</strong>
            </div>
            {showCustomer && (
              <div>
                <span style={{ color: C.faint }}>For </span>
                {sale.customerName || "Walk-in"}
              </div>
            )}
          </div>
          <div style={{ lineHeight: 1.6, textAlign: "right" }}>
            <div>{prettyDate(sale.createdAt)}</div>
            <div style={{ color: C.soft }}>{prettyTime(sale.createdAt)}</div>
          </div>
        </div>

        <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.rule}` }}>
          {sale.lines.map((l) => (
            <div
              key={l.key}
              style={{ ...row, padding: "6px 0", fontSize: 13, gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <div>{l.name}</div>
                <div style={{ fontSize: 11, color: C.faint }}>
                  {variantOf(l) ? `${variantOf(l)} · ` : ""}
                  {l.qty} × {inr(l.price)}
                </div>
              </div>
              <div style={{ fontWeight: 600 }}>{inr(lineTotal(l))}</div>
            </div>
          ))}
        </div>

        <div style={{ paddingTop: 12, fontSize: 13 }}>
          <div style={{ ...row, color: C.soft }}>
            <span>Subtotal</span>
            <span>{inr(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div style={{ ...row, color: C.maroon, marginTop: 4 }}>
              <span>{discountLabel}</span>
              <span>−{inr(sale.discountAmount)}</span>
            </div>
          )}
          <div
            style={{
              ...row,
              marginTop: 10,
              paddingTop: 10,
              borderTop: `2px solid ${C.ink}`,
              fontSize: 20,
            }}
          >
            <span style={{ fontFamily: "var(--font-display)" }}>
              Total paid
            </span>
            <span
              style={{ fontFamily: "var(--font-display)", color: C.maroon }}
            >
              {inr(sale.total)}
            </span>
          </div>
          <div style={{ ...small({ marginTop: 6, textAlign: "right" }) }}>
            by {sale.paymentMode}
          </div>
        </div>

        {sale.verifyCode && (
          <div style={{ ...small({ marginTop: 14, textAlign: "center" }) }}>
            Verify code{" "}
            <strong style={{ color: C.ink, letterSpacing: "0.12em" }}>
              {sale.verifyCode}
            </strong>
          </div>
        )}

        {PROMO && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: C.tint,
              textAlign: "center",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {PROMO.blurb}
            <div>
              Code{" "}
              <strong style={{ color: C.maroon, letterSpacing: "0.08em" }}>
                {PROMO.code}
              </strong>{" "}
              at {BUSINESS.website}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 12,
            color: C.soft,
            lineHeight: 1.7,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: C.ink,
            }}
          >
            {BUSINESS.thanks}
          </div>
          <div>
            {BUSINESS.website}
            {BUSINESS.instagram ? ` · ${BUSINESS.instagram}` : ""}
          </div>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TEETH_BOTTOM}
        alt=""
        width={360}
        height={TOOTH_H}
        style={{ display: "block" }}
      />
    </div>
  );
});

export default Receipt;
