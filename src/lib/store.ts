import type { Catalog } from "./catalog";
import * as dev from "./devstore";
import * as supabase from "./db";
import type { Review, ReviewEvent, Sale } from "./types";

/**
 * Where data lives. The routes talk to this and never choose for themselves.
 *
 *   supabase   the real thing, whenever its keys are set
 *   dev-file   no keys, and NOT production: a file on the dev machine
 *   none       no keys in production: the till says so and refuses to sell
 *
 * Nothing is kept on the iPad in any mode. The browser holds what is on screen
 * and nothing more.
 */
export type Mode = "supabase" | "dev-file" | "none";

export const mode = (): Mode =>
  supabase.storageConfigured()
    ? "supabase"
    : process.env.NODE_ENV !== "production"
      ? "dev-file"
      : "none";

export const available = () => mode() !== "none";

const via = () => (mode() === "supabase" ? supabase : dev);

export const insertSale = (sale: Sale) => via().insertSale(sale);
export const getSetting = <T>(id: string) => via().getSetting<T>(id);
export const putSetting = (id: string, data: unknown) =>
  via().putSetting(id, data);
export const deleteSetting = (id: string) => via().deleteSetting(id);
export const restoreSale = (s: Sale) => via().restoreSale(s);
export const deleteAllSales = () => via().deleteAllSales();
export const getStock = () => via().getStock();
export const setStock = (id: string, q: number | null) => via().setStock(id, q);
export const consumeStock = (t: Record<string, number>) =>
  via().consumeStock(t);
export const insertReview = (r: Review) => via().insertReview(r);
export const findReview = (saleId: string) => via().findReview(saleId);
export const listReviews = (limit?: number) => via().listReviews(limit);
export const markReviewEvent = (id: string, e: ReviewEvent) =>
  via().markReviewEvent(id, e);
export const listReviewStatus = () => via().listReviewStatus();
export const findSale = (id: string) => via().findSale(id);
export const findByInvoice = (n: string) => via().findByInvoice(n);
export const listSales = (limit?: number) => via().listSales(limit);
export const getCatalog = () => via().getCatalog();
export const putCatalog = (catalog: Catalog) => via().putCatalog(catalog);
export type { Sale };
