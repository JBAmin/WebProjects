require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const checkoutRoutes = require('./routes/checkout');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminAuthRoutes = require('./routes/adminAuth');

const app = express();

app.use(cors());

// Stripe webhook needs the RAW request body to verify its signature, so we
// skip JSON parsing for that one path (it parses its own raw body in routes/checkout.js).
app.use((req, res, next) => {
  if (req.originalUrl === '/api/checkout/webhook') return next();
  express.json()(req, res, next);
});

// API routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/orders', orderRoutes); // reuses orders.js admin sub-routes

// Serve the plain HTML/CSS/JS frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Dropship store server running on http://localhost:${PORT}`);
});
