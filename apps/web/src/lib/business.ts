/**
 * Who runs Pickixo, and what it sells — the one file the merchant pages read.
 *
 * Payment gateways (EPS, and any other Bangladeshi gateway) check that a site
 * shows a real business: name, address, phone, what is sold and for how much,
 * and how refunds work. Every one of those is a fact only the owner can state,
 * so nothing here is filled in by guesswork. A field left `null` is simply not
 * shown on the site; it is not replaced by a made-up value.
 *
 * To finish the EPS application, fill the `null` fields below (the list is in
 * docs/EPS_READY_BN.md), add the products in PRODUCTS, then rebuild.
 */

export type Business = {
  /** Trading name as printed on the trade licence. */
  legalName: string | null;
  /** Owner / proprietor name, if you want it shown on the About page. */
  proprietor: string | null;
  /** Full postal address, as on the trade licence. One line per entry. */
  address: string[] | null;
  /** Public phone number for customers, e.g. "+880 1XXX-XXXXXX". */
  phone: string | null;
  /** Public support email. Already listed on every Google Play page. */
  email: string;
  /** Hours someone answers, e.g. "Sat–Thu, 10:00–18:00 (BST)". */
  hours: string | null;
  /** Trade licence number, if you want it shown (gateways like seeing it). */
  tradeLicenceNo: string | null;
  /** Days after purchase within which a refund can be asked for. */
  refundWindowDays: number | null;
  /** Working days within which an approved refund is sent back. */
  refundProcessingDays: number | null;
  /** Date the policies below were last changed (YYYY-MM-DD). */
  policiesUpdated: string;
};

export const BUSINESS: Business = {
  legalName: null,
  proprietor: null,
  address: null,
  phone: null,
  email: 'support@pickixo.com',
  hours: null,
  tradeLicenceNo: null,
  refundWindowDays: null,
  refundProcessingDays: null,
  policiesUpdated: '2026-11-21',
};

/** The name to print: the licensed name once it is filled in, else "Pickixo". */
export const BUSINESS_NAME = BUSINESS.legalName ?? 'Pickixo';

export type Product = {
  slug: string;
  name: string;
  /** One or two plain sentences: what the buyer actually gets. */
  description: string;
  /** Price in Bangladeshi taka, VAT included if VAT applies. */
  priceBdt: number;
  /** How it reaches the buyer, e.g. "Download link by email within 10 minutes". */
  delivery: string;
  /** Optional page with more detail. */
  href?: string;
};

/**
 * Digital products sold on pickixo.com. Empty until the owner adds them —
 * the pricing page says so honestly rather than showing sample prices.
 */
export const PRODUCTS: Product[] = [];

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-IN')}`;
}
