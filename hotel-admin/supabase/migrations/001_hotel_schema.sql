-- ============================================================
-- Hotel Admin - Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  timezone TEXT DEFAULT 'America/Lima',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hotel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT DEFAULT 'receptionist',
  UNIQUE(hotel_id, user_id)
);

CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  capacity INT,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels NOT NULL,
  room_type_id UUID REFERENCES room_types,
  room_number TEXT NOT NULL,
  floor TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(hotel_id, room_number)
);

CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels NOT NULL,
  room_id UUID REFERENCES rooms,
  guest_id UUID REFERENCES guests,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes TEXT,
  source TEXT DEFAULT 'airtable',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON room_types (hotel_id, active);
CREATE INDEX ON rooms (hotel_id, active);
CREATE INDEX ON guests (hotel_id, phone);
CREATE INDEX ON reservations (hotel_id, check_in, check_out);
CREATE INDEX ON reservations (room_id, check_in, check_out);

ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION user_hotel_ids()
RETURNS SETOF UUID AS $$
  SELECT hotel_id FROM hotel_members WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE POLICY "members_select_own" ON hotel_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "hotel_read_own" ON hotels
  FOR SELECT USING (id IN (SELECT user_hotel_ids()));

CREATE POLICY "hotel_update_own" ON hotels
  FOR UPDATE USING (id IN (SELECT user_hotel_ids()));

CREATE POLICY "hotel_isolation_room_types" ON room_types
  FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "hotel_isolation_rooms" ON rooms
  FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "hotel_isolation_guests" ON guests
  FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));

CREATE POLICY "hotel_isolation_reservations" ON reservations
  FOR ALL USING (hotel_id IN (SELECT user_hotel_ids()));
