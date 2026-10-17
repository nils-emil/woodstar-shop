-- Email is optional at checkout: the pickup link is shown on the order page after payment anyway.
ALTER TABLE orders ALTER COLUMN email DROP NOT NULL;
