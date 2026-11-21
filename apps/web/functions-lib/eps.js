/**
 * EPS (Easy Payment System, eps.com.bd) client for Cloudflare Pages Functions.
 *
 * Follows EPS's own samples (github.com/EPS-PG: EPS_PHP, EPS_Nodejs):
 *
 *   1. POST /v1/Auth/GetToken                          x-hash = HMAC(userName)
 *   2. POST /v1/EPSEngine/InitializeEPS                x-hash = HMAC(merchantTransactionId)
 *        -> { TransactionId, RedirectURL }             send the buyer to RedirectURL
 *   3. GET  /v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=…
 *                                                      x-hash = HMAC(merchantTransactionId)
 *
 * HMAC is HMAC-SHA512 keyed with the UTF-8 bytes of the hash key, over the UTF-8
 * value, returned as Base64.
 *
 * Lives outside functions/ so Pages does not turn it into a route.
 *
 * Configuration (Cloudflare Pages → Settings → Variables and secrets):
 *   EPS_USERNAME, EPS_PASSWORD, EPS_HASH_KEY, EPS_MERCHANT_ID, EPS_STORE_ID
 *   EPS_SANDBOX = "1" while testing against sandboxpgapi.eps.com.bd
 */

const HOSTS = {
  sandbox: 'https://sandboxpgapi.eps.com.bd',
  live: 'https://pgapi.eps.com.bd',
};

const REQUIRED = ['EPS_USERNAME', 'EPS_PASSWORD', 'EPS_HASH_KEY', 'EPS_MERCHANT_ID', 'EPS_STORE_ID'];

/** The EPS settings, or null when any is missing (payments then stay closed). */
export function epsConfig(env) {
  if (!env || REQUIRED.some((k) => !env[k])) return null;
  return {
    username: env.EPS_USERNAME,
    password: env.EPS_PASSWORD,
    hashKey: env.EPS_HASH_KEY,
    merchantId: env.EPS_MERCHANT_ID,
    storeId: env.EPS_STORE_ID,
    host: env.EPS_SANDBOX === '1' ? HOSTS.sandbox : HOSTS.live,
    sandbox: env.EPS_SANDBOX === '1',
  };
}

export async function epsHash(value, hashKey) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(hashKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin);
}

export class EpsError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'EpsError';
    this.detail = detail;
  }
}

async function readJson(res, what) {
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new EpsError(`${what}: EPS answered ${res.status} with something that is not JSON`, text.slice(0, 300));
  }
  if (!res.ok) throw new EpsError(`${what}: EPS answered ${res.status}`, data);
  return data;
}

async function getToken(cfg, fetchImpl) {
  const res = await fetchImpl(`${cfg.host}/v1/Auth/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hash': await epsHash(cfg.username, cfg.hashKey) },
    body: JSON.stringify({ userName: cfg.username, password: cfg.password }),
  });
  const data = await readJson(res, 'GetToken');
  const token = data.token ?? data.Token;
  if (!token) throw new EpsError('GetToken: no token in the answer', data.errorMessage ?? data.ErrorMessage ?? data);
  return token;
}

/**
 * Start a payment. Returns { redirectUrl, epsTransactionId }.
 * `order` carries the fields below; amounts are in taka.
 */
export async function initializePayment(cfg, order, fetchImpl = fetch) {
  const token = await getToken(cfg, fetchImpl);
  const body = {
    merchantId: cfg.merchantId,
    storeId: cfg.storeId,
    CustomerOrderId: order.id,
    merchantTransactionId: order.id,
    transactionTypeId: 1, // web
    financialEntityId: 0,
    transitionStatusId: 0,
    totalAmount: order.amount,
    ipAddress: order.ip || '0.0.0.0',
    version: '1',
    successUrl: order.returnUrl,
    failUrl: order.returnUrl,
    cancelUrl: order.returnUrl,
    customerName: order.name,
    customerEmail: order.email,
    CustomerAddress: order.city,
    CustomerAddress2: '',
    CustomerCity: order.city,
    CustomerState: order.city,
    CustomerPostcode: order.postcode || '0000',
    CustomerCountry: 'BD',
    CustomerPhone: order.phone,
    ShipmentName: '',
    ShipmentAddress: '',
    ShipmentAddress2: '',
    ShipmentCity: '',
    ShipmentState: '',
    ShipmentPostcode: '',
    ShipmentCountry: '',
    ValueA: order.product,
    ValueB: '',
    ValueC: '',
    ValueD: '',
    ShippingMethod: 'NO',
    NoOfItem: '1',
    ProductName: order.productName,
    ProductProfile: 'general',
    ProductCategory: 'ebook',
    ProductList: [{
      ProductName: order.productName,
      NoOfItem: '1',
      ProductProfile: 'general',
      ProductCategory: 'ebook',
      ProductPrice: String(order.amount),
    }],
  };
  const res = await fetchImpl(`${cfg.host}/v1/EPSEngine/InitializeEPS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hash': await epsHash(order.id, cfg.hashKey),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await readJson(res, 'InitializeEPS');
  const redirectUrl = data.RedirectURL ?? data.redirectURL ?? data.redirectUrl;
  if (!redirectUrl || !/^https:\/\//.test(redirectUrl)) {
    throw new EpsError('InitializeEPS: no payment page address in the answer', data.ErrorMessage ?? data.errorMessage ?? data);
  }
  return { redirectUrl, epsTransactionId: data.TransactionId ?? data.transactionId ?? null };
}

/**
 * Ask EPS what happened to a payment. This, not anything in the buyer's
 * redirect URL, is what decides whether an order is paid.
 * Returns { status: 'success' | 'failed' | 'cancelled' | 'pending' | 'unknown', amount, raw }.
 */
export async function checkPayment(cfg, merchantTransactionId, fetchImpl = fetch) {
  const token = await getToken(cfg, fetchImpl);
  const url = `${cfg.host}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`;
  const res = await fetchImpl(url, {
    headers: {
      'x-hash': await epsHash(merchantTransactionId, cfg.hashKey),
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await readJson(res, 'CheckMerchantTransactionStatus');
  // EPS's samples read the status from several field names; accept each.
  const rawStatus = String(
    data.Status ?? data.status ?? data.transactionStatus ?? data.data?.status ?? data.data?.transactionStatus ?? '',
  ).toLowerCase();
  const status =
    ['success', 'successful', 'completed', 'paid'].includes(rawStatus) ? 'success'
    : ['failed', 'failure', 'fail'].includes(rawStatus) ? 'failed'
    : ['cancel', 'canceled', 'cancelled'].includes(rawStatus) ? 'cancelled'
    : ['pending', 'initiated', 'processing'].includes(rawStatus) ? 'pending'
    : 'unknown';
  const amount = Number(data.TotalAmount ?? data.totalAmount ?? data.data?.totalAmount ?? NaN);
  const returnedId = String(data.MerchantTransactionId ?? data.merchantTransactionId ?? merchantTransactionId);
  return { status, amount, matchesId: returnedId === merchantTransactionId, raw: data };
}
