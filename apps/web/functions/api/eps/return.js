/**
 * GET /api/eps/return?o=<order id> — EPS sends the buyer back here after
 * paying, failing or cancelling. Whatever EPS adds to the URL is ignored: the
 * order's state comes from asking EPS directly (settleOrder).
 */
import { epsConfig } from '../../../functions-lib/eps.js';
import { loadOrder, orderPage, page, settleOrder } from '../../../functions-lib/orders.js';

export async function onRequestGet({ request, env }) {
  if (!epsConfig(env) || !env.ORDERS) return page('Not found', '<h1>Order not found</h1>', 404);
  const url = new URL(request.url);
  const id = url.searchParams.get('o') || url.searchParams.get('MerchantTransactionId') || url.searchParams.get('merchantTransactionId');
  let order = await loadOrder(env, id);
  if (!order) return page('Order not found', '<h1>Order not found</h1><p>Please email <a href="mailto:support@pickixo.com">support@pickixo.com</a>.</p>', 404);
  try {
    order = await settleOrder(env, order, url.origin);
  } catch (err) {
    console.error('EPS status check failed', order.id, err?.message);
  }
  return orderPage(order, url.origin);
}

// Some gateways return with a POST; treat it the same.
export const onRequestPost = onRequestGet;
