import { variantOf } from "./money";
import { prettyDate, prettyTime } from "./time";
import type { Sale } from "./types";

/**
 * Spreadsheet cells that begin with = + - @ are executed as formulas when the
 * file is opened. A customer name typed at the till is untrusted input, so it
 * gets a leading apostrophe, which Excel and Sheets both read as "plain text".
 */
const cell = (v: string | number | boolean) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function salesToCsv(sales: Sale[]): string {
  const header = [
    "Invoice",
    "Date",
    "Time",
    "Customer",
    "Phone",
    "Messages OK",
    "Items",
    "Payment",
    "Subtotal",
    "Discount",
    "Total",
  ];
  const rows = sales.map((s) => [
    s.invoiceNo,
    prettyDate(s.createdAt),
    prettyTime(s.createdAt),
    s.customerName,
    s.customerPhone,
    s.marketingOk ? "Yes" : "No",
    s.lines
      .map(
        (l) => `${l.name}${variantOf(l) ? ` (${variantOf(l)})` : ""} x${l.qty}`,
      )
      .join("; "),
    s.paymentMode,
    s.subtotal,
    s.discountAmount,
    s.total,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/**
 * One row per item sold, not per bill.
 *
 * This is the shape a spreadsheet can count: filter a column to "Maroon", sum
 * Qty, pivot by Size. The discount applies to the whole bill and is not
 * apportioned across lines, so "Line total" is before discount — the bill's
 * own discount and total are on the other export.
 */
export function itemsToCsv(sales: Sale[]): string {
  const header = [
    "Invoice",
    "Date",
    "Time",
    "Item",
    "Size",
    "Colour",
    "Qty",
    "Unit price",
    "Line total",
    "Payment",
  ];
  const rows = sales.flatMap((s) =>
    s.lines.map((l) => [
      s.invoiceNo,
      prettyDate(s.createdAt),
      prettyTime(s.createdAt),
      l.name,
      l.size ?? "",
      l.color ?? "",
      l.qty,
      l.price,
      l.price * l.qty,
      s.paymentMode,
    ]),
  );
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
