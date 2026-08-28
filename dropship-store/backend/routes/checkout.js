const express = require('express');
const Stripe = require('stripe');
const pool = require('../db/pool');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/checkout/create-payment-intent
// Body: { items: [{ product_id, quantity }], customer: { name, email }, shipping_address: {...} }
router.post('/create-payment-intent', async (req, res) => {
  const { items, customer, shipping_address } = req.body;

  if (!items || !items.length || !customer?.email || !shipping_address) {
    return res.status(400).json({ error: 'items, customer, and shipping_address are required' });
  }

  try {
    // Look up real prices server-side — never trust prices sent from the client.
    const productIds = items.map((i) => i.product_id);
    const { rows: products } = await pool.query(
      'SELECT id, sale_price, currency, title, stock FROM products WHERE id = ANY($1) AND is_active = true',
      [productIds]
    );

    if (products.length !== items.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }

    let subtotal = 0;
    const currency = products[0].currency || 'USD';
    const lineItems = items.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (product.stock < item.quantity) {
        throw new Error(`Not enough stock for "${product.title}"`);
      }
      const lineTotal = parseFloat(product.sale_price) * item.quantity;
      subtotal += lineTotal;
      return { product_id: product.id, quantity: item.quantity, unit_price: product.sale_price };
    });

    const shippingCost = 0; // flat-rate/free shipping for MVP; wire up real carrier rates later
    const total = subtotal + shippingCost;

    // Create the order in a pending state before charging
    const orderResult = await pool.query(
      `INSERT INTO orders (customer_name, customer_email, shipping_address, subtotal, shipping_cost, total, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [customer.name, customer.email, JSON.stringify(shipping_address), subtotal, shippingCost, total, currency]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of lineItems) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, source)
         SELECT $1, $2, $3, $4, source FROM products WHERE id = $2`,
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Stripe uses the smallest currency unit (cents)
      currency: currency.toLowerCase(),
      metadata: { order_id: orderId.toString() },
      receipt_email: customer.email,
    });

    await pool.query('UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2', [
      paymentIntent.id,
      orderId,
    ]);

    res.json({ clientSecret: paymentIntent.client_secret, orderId });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/checkout/webhook (Stripe webhook — raw body, configured in server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const orderId = event.data.object.metadata.order_id;
    try {
      await pool.query("UPDATE orders SET status = 'paid', updated_at = now() WHERE id = $1", [orderId]);
      // From here, an admin (or a scheduled job) picks up 'paid' orders and
      // calls POST /api/admin/orders/:id/fulfill to place the supplier order.
    } catch (err) {
      console.error('Failed to mark order paid:', err);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const orderId = event.data.object.metadata.order_id;
    await pool.query("UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1", [orderId]).catch(console.error);
  }

  res.json({ received: true });
});

module.exports = router;
