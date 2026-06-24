-- Seed the first hotel row after 001_hotel_schema.sql is applied.
-- Run this in Supabase SQL Editor if you want a fixed initial tenant row.

INSERT INTO hotels (slug, name, phone, address, timezone)
VALUES (
  'hotel-cascabel',
  'Hotel Cascabel',
  NULL,
  NULL,
  'America/Lima'
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  timezone = EXCLUDED.timezone;
