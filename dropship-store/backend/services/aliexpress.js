/**
 * AliExpress Open Platform integration.
 *
 * BEFORE THIS WORKS, YOU MUST:
 * 1. Register as a developer at https://openservice.aliexpress.com
 * 2. Apply for the "AliExpress Dropshipper" / Open Platform API access
 *    (product query + order-placement scopes are separate approvals;
 *    order placement requires a business/dropshipping partner review,
 *    it is not granted automatically).
 * 3. Get an App Key + App Secret, and generate an access token (OAuth)
 *    for the AliExpress seller/dropshipper account you'll fulfill from.
 * 4. Put those values in your .env file (see .env.example).
 *
 * AliExpress signs every request the same way (regardless of the specific
 * method called): sort all params alphabetically, concatenate key+value,
 * wrap with the app secret, and HMAC-SHA256 (or MD5, depending on the API
 * version you're approved for) to produce a `sign` param.
 *
 * The method names below (aliexpress.affiliate.product.query,
 * aliexpress.trade.buy.placeorder) are the real Open Platform method names,
 * but exact required parameters can change per your API version/approval,
 * so check the docs in your developer console before going live:
 * https://openservice.aliexpress.com/doc
 */

const crypto = require('crypto');

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const ACCESS_TOKEN = process.env.ALIEXPRESS_ACCESS_TOKEN;
const API_GATEWAY = 'https://api-sg.aliexpress.com/sync'; // AliExpress sync gateway

function sign(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  let base = secret;
  for (const key of sortedKeys) {
    base += key + params[key];
  }
  base += secret;
  return crypto.createHash('md5').update(base, 'utf8').digest('hex').toUpperCase();
}

async function callAliExpressApi(method, businessParams = {}) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error(
      'AliExpress API credentials are not configured. Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET in .env'
    );
  }

  const systemParams = {
    method,
    app_key: APP_KEY,
    session: ACCESS_TOKEN || '',
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
  };

  const allParams = { ...systemParams, ...businessParams };
  allParams.sign = sign(allParams, APP_SECRET);

  const query = new URLSearchParams(allParams).toString();

  const response = await fetch(`${API_GATEWAY}?${query}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`AliExpress API request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Look up a single product by its AliExpress product ID.
 * Product ID is the numeric ID in the product URL, e.g.
 * https://www.aliexpress.com/item/1005001234567890.html -> 1005001234567890
 */
async function getProductByUrl(productUrl) {
  const match = productUrl.match(/item\/(\d+)\.html/) || productUrl.match(/(\d{10,})/);
  if (!match) {
    throw new Error('Could not extract a product ID from that AliExpress URL');
  }
  const productId = match[1];

  const data = await callAliExpressApi('aliexpress.affiliate.product.query', {
    product_ids: productId,
    target_currency: 'USD',
    target_language: 'EN',
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID || 'default',
  });

  const result =
    data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products
      ?.product?.[0];

  if (!result) {
    throw new Error('Product not found or API response shape unexpected — check the raw response and your API version');
  }

  return {
    source: 'aliexpress',
    source_product_id: productId,
    source_url: productUrl,
    title: result.product_title,
    image_url: result.product_main_image_url,
    images: result.product_small_image_urls?.string || [],
    cost_price: parseFloat(result.target_sale_price || result.target_original_price || 0),
    currency: result.target_sale_price_currency || 'USD',
  };
}

/**
 * Place a dropship order with AliExpress once a customer has paid you.
 * This calls the trade/order-placement API on the supplier's behalf,
 * shipping directly to your end customer's address.
 *
 * Requires the dropshipping/business API approval mentioned above —
 * this scope is NOT included in basic affiliate API access.
 */
async function placeDropshipOrder({ productId, quantity, shippingAddress }) {
  const addressParam = JSON.stringify({
    contact_person: shippingAddress.name,
    address: shippingAddress.line1,
    address2: shippingAddress.line2 || '',
    city: shippingAddress.city,
    province: shippingAddress.state,
    zip: shippingAddress.postal_code,
    country: shippingAddress.country, // ISO 2-letter code, e.g. "US"
    phone_country: shippingAddress.phoneCountryCode || '1',
    mobile_no: shippingAddress.phone || '',
  });

  const data = await callAliExpressApi('aliexpress.trade.buy.placeorder', {
    product_items: JSON.stringify([{ product_id: productId, product_count: quantity }]),
    logistics_address: addressParam,
  });

  const result = data?.aliexpress_trade_buy_placeorder_response?.result;
  if (!result || result.is_success === false) {
    throw new Error(
      `AliExpress order placement failed: ${JSON.stringify(data)}`
    );
  }

  return {
    supplier_order_id: result.order_list?.number?.[0] || result.order_id,
    raw: result,
  };
}

module.exports = { getProductByUrl, placeDropshipOrder };
