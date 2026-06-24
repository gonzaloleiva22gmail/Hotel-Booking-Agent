-- ============================================================
-- Seed: Marjorie — Clínica Dental Marjorie, Lima Peru
-- Run AFTER creating Marjorie's auth user in Supabase Dashboard
-- Replace <MARJORIE_USER_ID> with her actual auth.users UUID
-- ============================================================

INSERT INTO clinics (slug, name, phone, address, timezone)
VALUES (
  'marjorie',
  'Clínica Dental Marjorie',
  '+51 999 000 000',
  'Lima, Peru',
  'America/Lima'
);

-- Add Marjorie as admin (replace <MARJORIE_USER_ID>)
-- INSERT INTO clinic_members (clinic_id, user_id, role)
-- VALUES (
--   (SELECT id FROM clinics WHERE slug = 'marjorie'),
--   '<MARJORIE_USER_ID>',
--   'admin'
-- );

-- Services (update durations and prices once confirmed)
INSERT INTO services (clinic_id, name, duration_minutes, price_pen)
SELECT id, 'Limpieza dental', 60, 150.00 FROM clinics WHERE slug = 'marjorie';

INSERT INTO services (clinic_id, name, duration_minutes, price_pen)
SELECT id, 'Consulta general', 30, 80.00 FROM clinics WHERE slug = 'marjorie';

INSERT INTO services (clinic_id, name, duration_minutes, price_pen)
SELECT id, 'Blanqueamiento dental', 90, 350.00 FROM clinics WHERE slug = 'marjorie';

INSERT INTO services (clinic_id, name, duration_minutes, price_pen)
SELECT id, 'Extracción', 45, 120.00 FROM clinics WHERE slug = 'marjorie';

-- Specialists (add real names once confirmed)
INSERT INTO specialists (clinic_id, name, specialty)
SELECT id, 'Dra. Marjorie', 'Odontología General' FROM clinics WHERE slug = 'marjorie';

-- Link specialist to all services
INSERT INTO specialist_services (specialist_id, service_id)
SELECT s.id, sv.id
FROM specialists s
CROSS JOIN services sv
WHERE s.clinic_id = (SELECT id FROM clinics WHERE slug = 'marjorie')
  AND sv.clinic_id = (SELECT id FROM clinics WHERE slug = 'marjorie');

-- Working hours: Mon–Sat 9am–6pm (day_of_week: 0=Mon ... 5=Sat)
INSERT INTO working_hours (clinic_id, specialist_id, day_of_week, start_time, end_time)
SELECT
  c.id,
  s.id,
  d.day,
  '09:00',
  '18:00'
FROM clinics c
CROSS JOIN specialists s
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5)) AS d(day)
WHERE c.slug = 'marjorie'
  AND s.clinic_id = c.id;
