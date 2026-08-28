const express = require('express');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const aliexpress = require('../services/aliexpress');

const router = express.Router();

// GET /api/orders/:id — customer order status lookup
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT oi.*, p.title, p.image_url FROM order_items oi
       JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
      [req.params.id]
    );

    res.json({ order: rows[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ---------- ADMIN ----------

// GET /api/admin/orders?status=paid — protected
router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    const { rows } = await pool.query(
      status ? 'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC' : 'SELECT * FROM orders ORDER BY created_at DESC',
      status ? [status] : []
    );
    res.json({ orders: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/admin/orders/:id/fulfill — protected
// Places the real order with AliExpress for each item sourced from AliExpress.
router.post('/:id/fulfill', requireAdmin, async (req, res) => {
  const orderId = req.params.id;

  try {
    const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderRows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'paid') {
      return res.status(400).json({ error: `Order must be 'paid' to fulfill, currently '${order.status}'` });
    }

    const { rows: items } = await pool.query(
      `SELECT oi.*, p.source_product_id FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND oi.source = 'aliexpress' AND oi.fulfillment_status = 'unfulfilled'`,
      [orderId]
    );

    const results = [];
    for (const item of items) {
      try {
        const supplierOrder = await aliexpress.placeDropshipOrder({
          productId: item.source_product_id,
          quantity: item.quantity,
          shippingAddress: {
            name: order.customer_name,
            ...order.shipping_address,
          },
        });

        await pool.query(
          `UPDATE order_items SET fulfillment_status = 'ordered_with_supplier', supplier_order_id = $1 WHERE id = $2`,
          [supplierOrder.supplier_order_id, item.id]
        );
        results.push({ item_id: item.id, success: true, supplier_order_id: supplierOrder.supplier_order_id });
      } catch (err) {
        await pool.query(`UPDATE order_items SET fulfillment_status = 'failed' WHERE id = $1`, [item.id]);
        results.push({ item_id: item.id, success: false, error: err.message });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    await pool.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [
      allSucceeded ? 'fulfilling' : 'paid',
      orderId,
    ]);

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fulfill order' });
  }
});

// PATCH /api/admin/orders/:id — protected (manual status update, e.g. mark shipped/tracking)
router.patch('/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending_payment', 'paid', 'fulfilling', 'fulfilled', 'shipped', 'cancelled', 'refunded'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json({ order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

module.exports = router;
