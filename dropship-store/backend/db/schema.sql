-- Dropship Store Database Schema (PostgreSQL)
-- Run with: psql -U youruser -d dropship_store -f schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id                SERIAL PRIMARY KEY,
  source            VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'aliexpress' | 'manual'
  source_product_id VARCHAR(100),                          -- AliExpress product id, if imported
  source_url        TEXT,                                  -- original supplier URL
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  category          VARCHAR(150),
  cost_price        NUMERIC(10,2) NOT NULL DEFAULT 0,       -- what you pay the supplier
  sale_price        NUMERIC(10,2) NOT NULL,                 -- what you charge the customer
  currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
  image_url         TEXT,
  images            JSONB DEFAULT '[]',
  stock             INTEGER NOT NULL DEFAULT 0,
  shipping_info     JSONB DEFAULT '{}',                     -- e.g. { "days": "12-20", "cost": 0 }
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source, source_product_id);

CREATE TABLE IF NOT EXISTS orders (
  id                      SERIAL PRIMARY KEY,
  customer_name           VARCHAR(255) NOT NULL,
  customer_email          VARCHAR(255) NOT NULL,
  shipping_address        JSONB NOT NULL,                    -- { line1, line2, city, state, postal_code, country }
  subtotal                NUMERIC(10,2) NOT NULL,
  shipping_cost           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                   NUMERIC(10,2) NOT NULL,
  currency                VARCHAR(10) NOT NULL DEFAULT 'USD',
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | paid | fulfilling | fulfilled | shipped | cancelled | refunded
  stripe_payment_intent_id VARCHAR(255),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id                   SERIAL PRIMARY KEY,
  order_id             INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id           INTEGER NOT NULL REFERENCES products(id),
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           NUMERIC(10,2) NOT NULL,
  source               VARCHAR(20) NOT NULL,                 -- 'aliexpress' | 'manual'
  fulfillment_status   VARCHAR(30) NOT NULL DEFAULT 'unfulfilled',
  -- unfulfilled | ordered_with_supplier | shipped | failed
  supplier_order_id    VARCHAR(150),                          -- order id returned by AliExpress API
  supplier_tracking_no VARCHAR(150),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
