const express = require('express');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const aliexpress = require('../services/aliexpress');

const router = express.Router();

// ---------- PUBLIC ----------

// GET /api/products?category=&search=&page=&limit=
router.get('/', async (req, res) => {
  const { category, search, page = 1, limit = 24 } = req.query;
  const conditions = ['is_active = true'];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`title ILIKE $${values.length}`);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  values.push(parseInt(limit), offset);

  const query = `
    SELECT id, title, sale_price, currency, image_url, category, stock
    FROM products
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `;

  try {
    const { rows } = await pool.query(query, values);
    res.json({ products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ---------- ADMIN ----------

// POST /api/products (manual add) — protected
router.post('/', requireAdmin, async (req, res) => {
  const {
    title, description, category, cost_price, sale_price,
    currency = 'USD', image_url, images = [], stock = 0, shipping_info = {},
  } = req.body;

  if (!title || !sale_price) {
    return res.status(400).json({ error: 'title and sale_price are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products
        (source, title, description, category, cost_price, sale_price, currency, image_url, images, stock, shipping_info)
       VALUES ('manual', $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [title, description, category, cost_price || 0, sale_price, currency, image_url, JSON.stringify(images), stock, JSON.stringify(shipping_info)]
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// POST /api/products/import-aliexpress — protected
// Body: { url: "https://www.aliexpress.com/item/...html", sale_price: 29.99, category: "..." }
router.post('/import-aliexpress', requireAdmin, async (req, res) => {
  const { url, sale_price, category } = req.body;
  if (!url || !sale_price) {
    return res.status(400).json({ error: 'url and sale_price are required' });
  }

  try {
    const imported = await aliexpress.getProductByUrl(url);

    const { rows } = await pool.query(
      `INSERT INTO products
        (source, source_product_id, source_url, title, category, cost_price, sale_price, currency, image_url, images, stock)
       VALUES ('aliexpress', $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        imported.source_product_id, imported.source_url, imported.title, category || null,
        imported.cost_price, sale_price, imported.currency, imported.image_url,
        JSON.stringify(imported.images), 999, // AliExpress stock is effectively supplier-side
      ]
    );

    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// PATCH /api/products/:id — protected
router.patch('/:id', requireAdmin, async (req, res) => {
  const fields = ['title', 'description', 'category', 'sale_price', 'stock', 'is_active', 'image_url'];
  const updates = [];
  const values = [];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE products SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — protected (soft delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE products SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
