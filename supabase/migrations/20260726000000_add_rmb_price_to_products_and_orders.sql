ALTER TABLE products ADD COLUMN rmb_price numeric;
ALTER TABLE orders ADD COLUMN rmb_price numeric DEFAULT 0;
