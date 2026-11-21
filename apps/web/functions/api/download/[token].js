/**
 * GET /api/download/<token> — the paid PDF, from the R2 bucket PRODUCT_FILES.
 * A token lasts DOWNLOAD_DAYS and allows MAX_DOWNLOADS downloads.
 */
import { MAX_DOWNLOADS, findProduct, loadOrder, page, saveOrder } from '../../../functions-lib/orders.js';

const gone = (msg) => page('Link expired', `<h1>This download link has expired</h1><p>${msg}
Email <a href="mailto:support@pickixo.com">support@pickixo.com</a> with your order number and we will send a new one.</p>`, 410);

export async function onRequestGet({ params, env }) {
  if (!env.ORDERS) return page('Not found', '<h1>Not found</h1>', 404);
  const token = String(params.token || '');
  if (!/^[0-9a-f]{48}$/.test(token)) return page('Not found', '<h1>Not found</h1>', 404);
  const id = await env.ORDERS.get(`dl:${token}`);
  const order = id ? await loadOrder(env, id) : null;
  if (!order || order.status !== 'paid' || order.downloadToken !== token) return gone('');
  if ((order.downloads ?? 0) >= MAX_DOWNLOADS) return gone(`It has been used ${MAX_DOWNLOADS} times.`);

  const product = findProduct(order.product);
  const object = product?.file && env.PRODUCT_FILES ? await env.PRODUCT_FILES.get(product.file) : null;
  if (!object) {
    console.error('Product file missing', order.product, product?.file);
    return page('File not ready', `<h1>Your payment is safe</h1><p>The file is not available for download at the moment.
We will email it to ${order.email.replace(/[<>&"]/g, '')} — or write to <a href="mailto:support@pickixo.com">support@pickixo.com</a> with order ${order.id}.</p>`, 503);
  }
  order.downloads = (order.downloads ?? 0) + 1;
  await saveOrder(env, order);
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${product.file}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
