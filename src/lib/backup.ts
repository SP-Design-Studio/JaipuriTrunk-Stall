import type { Sale } from "./types";

/**
 * A backup you can put back. The CSVs are reports (display dates, items as one
 * line of text) and cannot be restored from; this keeps every bill exactly, so
 * "Restore" can recreate it with its bill number, time and items.
 */
export const BACKUP_APP = "jaipuritrunk-stall-bills";

export function backupOf(sales: Sale[]): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      // The link and code are worked out again by the server; not part of a bill.
      sales: sales.map(({ receiptPath: _a, verifyCode: _b, ...bill }) => {
        void _a;
        void _b;
        return bill;
      }),
    },
    null,
    1,
  );
}
