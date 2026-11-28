import productsJson from '@/data/products.json';

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
  legalName: 'Pickixo (পিকিক্সো)',
  proprietor: 'Md. Monjurul Hye (মোঃ মনজুরুল হাই)',
  address: ['Tengaora, Mohanganj', 'Netrokona 2446, Bangladesh'],
  phone: '+880 1616-467360',
  email: 'support@pickixo.com',
  hours: 'Every day, 6:00 pm – 11:00 pm (Bangladesh time)',
  tradeLicenceNo: '77343802260236',
  refundWindowDays: 7,
  refundProcessingDays: 7,
  policiesUpdated: '2026-11-21',
};

/** The name to print: the licensed name once it is filled in, else "Pickixo". */
export const BUSINESS_NAME = BUSINESS.legalName ?? 'Pickixo';

export type Product = {
  /** File name in the R2 bucket bound as PRODUCT_FILES (the PDF itself). */
  file?: string;
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
  /** Shelf on /shop: an ebook (PDF) or a tool (app, template, script). */
  kind?: 'ebook' | 'tool';
  /** Ebooks: page count, language and table of contents, shown on the product page. */
  pages?: number;
  language?: string;
  contents?: string[];
};

/**
 * Digital products sold on pickixo.com. Empty until the owner adds them —
 * the shop says so honestly rather than showing sample prices.
 */
// The list lives in src/data/products.json so the payment functions in
// functions/api/eps read the same names and prices: the price charged is always
// the one on this page, never one sent by the browser.
export const PRODUCTS: Product[] = productsJson as Product[];

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-IN')}`;
}
