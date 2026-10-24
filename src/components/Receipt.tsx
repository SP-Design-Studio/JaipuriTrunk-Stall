import { forwardRef } from "react";
import { BUSINESS, PROMO } from "@/lib/config";
import { describeDiscount, inr, lineTotal, variantOf } from "@/lib/money";
import { prettyDate, prettyTime } from "@/lib/time";
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
  maroon: "#7f1634",
  olive: "#b0541a",
  tint: "#f9e6d6",
};

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
        boxSizing: "border-box",
        padding: "28px 26px 24px",
        background: C.paper,
        color: C.ink,
        fontFamily: "var(--font-body)",
        border: `1px solid ${C.rule}`,
      }}
    >
      <div
        style={{
          textAlign: "center",
          paddingBottom: 16,
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.png"
          alt={BUSINESS.name}
          width={132}
          height={132}
          style={{ display: "block", margin: "0 auto" }}
        />
        <div style={small({ marginTop: 10 })}>{BUSINESS.tagline}</div>
        {BUSINESS.address && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: C.soft,
              lineHeight: 1.5,
            }}
          >
            {BUSINESS.address}
          </div>
        )}
        {BUSINESS.phone && (
          <div style={{ fontSize: 12, color: C.soft }}>{BUSINESS.phone}</div>
        )}
        {BUSINESS.gstin && (
          <div style={{ fontSize: 12, color: C.soft, letterSpacing: "0.06em" }}>
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
          <span style={{ fontFamily: "var(--font-display)" }}>Total paid</span>
          <span style={{ fontFamily: "var(--font-display)", color: C.maroon }}>
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
  );
});

export default Receipt;
