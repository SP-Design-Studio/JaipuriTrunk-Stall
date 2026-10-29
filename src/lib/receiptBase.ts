/**
 * The address customers' links start with: the public one if it is set
 * (NEXT_PUBLIC_RECEIPT_BASE_URL, e.g. https://stall.jaipuritrunk.com), otherwise
 * whatever address this till was opened on. Browser only.
 */
export const receiptBase = () =>
  (process.env.NEXT_PUBLIC_RECEIPT_BASE_URL || window.location.origin).replace(
    /\/+$/,
    "",
  );
