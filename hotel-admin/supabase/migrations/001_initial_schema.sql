-- ============================================================
-- Clinic Booking SaaS — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Tenancy
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  timezone TEXT DEFAULT 'America/Lima',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT DEFAULT 'receptionist',
  UNIQUE(clinic_id, user_id)
);

-- Scheduling Domain
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price_pen NUMERIC(10,2),
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT,
  bio TEXT,
  photo_url TEXT,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE specialist_services (
  specialist_id UUID REFERENCES specialists NOT NULL,
  service_id UUID REFERENCES services NOT NULL,
  PRIMARY KEY (specialist_id, service_id)
);

CREATE TABLE working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  specialist_id UUID REFERENCES specialists NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE blocked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  specialist_id UUID REFERENCES specialists,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics NOT NULL,
  service_id UUID REFERENCES services NOT NULL,
  specialist_id UUID REFERENCES specialists NOT NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON appointments (clinic_id, appointment_date);
CREATE INDEX ON appointments (specialist_id, appointment_date);
CREATE INDEX ON working_hours (specialist_id, day_of_week);
CREATE INDEX ON blocked_periods (specialist_id, start_datetime, end_datetime);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of a clinic?
CREATE OR REPLACE FUNCTION user_clinic_ids()
RETURNS SETOF UUID AS $$
  SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- clinic_members: users can see their own membership rows
CREATE POLICY "members_select_own" ON clinic_members
  FOR SELECT USING (user_id = auth.uid());

-- All domain tables: clinic members see only their clinic's data
CREATE POLICY "clinic_isolation_services" ON services
  FOR ALL USING (clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY "clinic_isolation_specialists" ON specialists
  FOR ALL USING (clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY "clinic_isolation_specialist_services" ON specialist_services
  FOR ALL USING (
    specialist_id IN (
      SELECT id FROM specialists WHERE clinic_id IN (SELECT user_clinic_ids())
    )
  );

CREATE POLICY "clinic_isolation_working_hours" ON working_hours
  FOR ALL USING (clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY "clinic_isolation_blocked_periods" ON blocked_periods
  FOR ALL USING (clinic_id IN (SELECT user_clinic_ids()));

CREATE POLICY "clinic_isolation_appointments" ON appointments
  FOR ALL USING (clinic_id IN (SELECT user_clinic_ids()));

-- clinics: members can read their own clinic info
CREATE POLICY "clinic_read_own" ON clinics
  FOR SELECT USING (id IN (SELECT user_clinic_ids()));

CREATE POLICY "clinic_update_own" ON clinics
  FOR UPDATE USING (id IN (SELECT user_clinic_ids()));
