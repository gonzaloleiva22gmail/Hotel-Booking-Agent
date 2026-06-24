# Hotel Admin App (Oscar) — Twilio + Supabase Plan

> Execution plan for Codex agents. Tasks are grouped into phases with explicit
> dependencies and verification steps. Follow phase order; within a phase,
> tasks can often run in parallel unless noted.

## Goal

Build a hotel-admin Next.js app for Oscar's hotel inside this repo
(`Hotel Reservation Automation`), modeled on the clinic-admin app's structure
and UI patterns, backed by a new hotel-native Supabase schema. Migrate
existing Airtable reservation/room data into Supabase once, then repoint the
existing n8n WhatsApp booking automation to write to Supabase instead of
Airtable. Retire `availability-grid` once the new occupancy grid ships.

**Twilio stays unchanged** — only the data write target (Airtable → Supabase)
changes.

## Reference implementation

`C:\repo\Hotel Clinics Agents\Clinic-Appointment-Automation\clinic-admin` is
the UI/architecture reference (Next.js App Router, Tailwind, Supabase). Reuse
its patterns, NOT its domain model:

- `app/admin/[slug]/...` — admin route structure, layout, navigation
- `app/api/clinics/[slug]/...` — Next.js API routes using
  `lib/supabase.ts::createServiceClient()` (service-role client) for direct
  CRUD against Supabase tables, scoped by tenant id
- `app/admin/[slug]/services/page.tsx` + `app/api/clinics/[slug]/services/route.ts`
  — canonical "list + add/edit modal + CRUD API route" pattern. Use this as
  the template for hotel room-types/rooms management.
- `app/api/clinics/[slug]/settings/route.ts` — pattern for the hotel settings
  page (PATCH on the tenant row).
- `supabase/migrations/001_initial_schema.sql` — migration file structure to
  follow for the new hotel schema.

## Prerequisites / credentials

- **Supabase** — same shared project as clinic-admin. Copy
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` from
  `Clinic-Appointment-Automation/clinic-admin/.env.local` into the new app's
  `.env.local` (Phase 3 setup step).
- **Airtable** — `AIRTABLE_API_KEY` is in
  `Hotel Reservation Automation/availability-grid/.env.local`. Copy into the
  migration script's env (Phase 2).
- **n8n** — existing n8n MCP connection / API key covers Phase 4 workflow
  edits.
- **Applying the schema migration (Phase 1, task 4)** — use whatever
  connection Codex already uses to apply clinic-admin migrations to this same
  Supabase project (same approach worked for `001_initial_schema.sql`). If
  that path turns out not to support DDL for some reason, fall back to: paste
  `supabase/migrations/001_hotel_schema.sql` into the Supabase SQL Editor
  manually, then continue with task 5 (seeding, which works fine via the
  service-role key).

## Systems involved

| System | Role | Notes |
|---|---|---|
| Supabase (shared project) | New hotel schema, lives alongside clinic schema | Use existing project; create new tables only |
| Airtable (base `appe9ophN5EpDuPHZ`) | Migration source only — `Reservations` + `Tipo de Habitación` tables | Read-only after migration |
| n8n Cloud (`gonzaloleiva22.app.n8n.cloud`) | Live hotel automation is split across one WhatsApp workflow plus four Vapi workflows | Repoint the live WhatsApp/Vapi tool workflows to Supabase; ignore obsolete dev-only combined workflows |
| Twilio WhatsApp Sandbox | Unchanged | No work needed here |
| New Next.js app (this repo) | Target deliverable | Scaffolded from clinic-admin |

---

## Phase 1 — Hotel Supabase Schema (blocks all other phases)

1. **Inspect Airtable schema live** via the Airtable API: pull full field list,
   types, and sample records for `Reservations` and `Tipo de Habitación`
   (base `appe9ophN5EpDuPHZ`). Confirm whether `Tipo de Habitación` contains a
   definitive room inventory (room numbers + types as master data) or only
   room-type definitions. Document findings before proceeding to Phase 2.
2. Design hotel-native Supabase tables, every table carrying `hotel_id` FK
   (multi-tenant-ready even though only Oscar's hotel exists today):
   - `hotels` (id, slug, name, phone, address, timezone, ...) — mirrors `clinics`
   - `hotel_members` (hotel_id, user_id, role) — mirrors `clinic_members`
   - `room_types` (id, hotel_id, name, description, price, capacity, active)
   - `rooms` (id, hotel_id, room_type_id, room_number, floor, notes, active)
   - `guests` (id, hotel_id, name, phone, notes)
   - `reservations` (id, hotel_id, room_id, guest_id, check_in, check_out,
     status, notes, source, created_at)
3. Write SQL migration file(s) (e.g. `supabase/migrations/001_hotel_schema.sql`)
   in the new app, following clinic-admin's migration structure. Include RLS
   policies scoped by `hotel_id` via `hotel_members`, mirroring the clinic
   policies.
4. Apply migration to the shared Supabase project.
5. Seed Oscar's `hotels` row (slug, name, etc.) and a `hotel_members` row for
   staff login.

**Verify:** tables exist in Supabase; a test user scoped to Oscar's `hotel_id`
via `hotel_members` can read/write only Oscar's rows (RLS works).

---

## Phase 2 — Data Migration (Airtable → Supabase)

*Depends on: Phase 1 complete. Can run in parallel with Phase 3.*

6. Build a one-time migration script (Node, alongside the new app) using the
   Airtable API:
   - Read `Tipo de Habitación` → populate `room_types` (+ `rooms` if Airtable
     holds a definitive room list per finding from task 1; otherwise derive
     the distinct room list from `Reservations.Room_Number`/`Room_Type` and
     flag any ambiguous/missing rooms for manual review).
   - Read `Reservations` → populate `guests` (dedupe by phone/name) and
     `reservations`, mapping `Guest_Name`, `Check_In`, `Check_Out`,
     `Room_Type` → `room_type_id`, `Room_Number` → `room_id`, `Phone_Number`,
     `Notes`, `Created_At`.
7. Run the migration against Supabase. Log row counts per table.

**Verify:** Supabase row counts match Airtable export counts; spot-check 5–10
reservations for correct field mapping and that `room_id`/`room_type_id`/
`hotel_id` resolve to valid rows (no orphans).

---

## Phase 3 — Hotel Admin App (frontend)

*Depends on: Phase 1 complete. Can run in parallel with Phase 2 (use seed
data for development; swap to migrated data once Phase 2 is verified).*

8. Scaffold a new Next.js App Router app in this repo, cloning clinic-admin's
   structure: Tailwind theme/config, `lib/supabase.ts` (service-role client),
   `lib/supabase-server.ts`, login flow, admin layout/nav.
9. Supabase Auth + `hotel_members`-based access control for Oscar's staff.
10. Dashboard/home shell with nav (mirrors clinic-admin's `admin/[slug]/page.tsx`
    + `layout.tsx`).
11. **Occupancy grid (headline feature)** — rooms as rows, days as columns:
    - Month view by default, with a **Previous month / Next month**
      navigator so staff can move seamlessly from e.g. September into
      October (simplest approach — re-renders the grid for the selected
      month range, no virtualization needed)
    - Normal horizontal scroll within a month on smaller screens (only
      ~30 day-columns, works without extra effort)
    - Each cell shows available/occupied + guest name; click-through to
      reservation detail
    - *Future enhancement (not in V1)*: continuous Excel-style horizontal
      scroll across month boundaries with a sticky room-name column —
      revisit once the core grid/data layer is proven
12. Reservation list + detail view (view/edit/cancel), API routes under
    `/api/hotels/[slug]/reservations`.
13. **Room types management** — list + add/edit modal (name, description,
    price, capacity, active), API routes under `/api/hotels/[slug]/room-types`
    — direct CRUD-to-Supabase, following the
    `services/page.tsx` + `services/route.ts` pattern exactly.
14. **Rooms management** — list + add/edit modal (room number, room type,
    floor/notes, active/out-of-service toggle), API routes under
    `/api/hotels/[slug]/rooms` — same CRUD-to-Supabase pattern.
15. Guest management view (list/search guests, view reservation history).
16. Hotel settings page — PATCH on `hotels` row (name, address, phone,
    timezone), following `settings/route.ts` pattern.

**Verify:** app runs locally against Supabase (seed or migrated data); login
works; grid renders correctly across week/month/multi-month views; all CRUD
pages (room types, rooms, settings, reservations) persist changes visible on
reload.

---

## Phase 4 — Repoint Live Automation (last)

*Depends on: Phase 2 and Phase 3 complete and verified.*

17. Back up and inspect the **actual live workflow set**, not the obsolete
    combined dev workflow:
    - `Hotel Booking Reservation Automation - WhatsApp`
    - `Vapi Tool - Create Booking`
    - `Vapi Tool - Check Room Inventory`
    - `Vapi Tool - Check Booked Rooms`
    - `Vapi Tool - Escalate Owner`
18. In `Vapi Tool - Create Booking`, replace Airtable writes with a Supabase
    write path (HTTP Request to Supabase REST API or Postgres node), creating
    or updating `guests` and inserting `reservations` rows scoped to Oscar's
    `hotel_id`.
19. In `Vapi Tool - Check Room Inventory`, replace Airtable reads with
    Supabase reads from `rooms` and `room_types` so the voice agent sees the
    real hotel inventory from the new schema.
20. In `Vapi Tool - Check Booked Rooms`, replace Airtable reservation lookups
    with Supabase reads from `reservations`, checking overlap against
    `check_in` / `check_out` for the requested stay.
21. Update `Hotel Booking Reservation Automation - WhatsApp` so the live
    WhatsApp/text automation calls the correct Supabase-backed booking and
    availability logic instead of any Airtable-backed tool path.
22. Inspect `Vapi Tool - Escalate Owner` and confirm whether it touches hotel
    reservation data. If it does, repoint it away from Airtable; if it does
    not, leave the escalation behavior unchanged and document that no data-path
    rewrite was required.
23. Leave Twilio transport, Vapi transport, intent classification, AI-agent
    behavior, and Redis/session-state behavior unchanged unless workflow
    inspection proves a specific dependency on Airtable.
24. Dry run:
    - send a test WhatsApp booking through the live WhatsApp workflow
    - send a test voice-booking flow through the Vapi path
    - confirm both create or query data in Supabase correctly and that the
      booking appears in the admin app occupancy grid in real time

**Verify:** end-to-end test booking visible in the grid within seconds;
Airtable receives no new writes from this point forward.

---

## Phase 5 — Cutover & Cleanup

*Depends on: Phase 4 verified.*

25. Confirm no remaining code paths (frontend or n8n) read/write Airtable for
    hotel reservation data.
26. Archive/remove the `availability-grid` directory from this repo.
27. Mark the Airtable base as historical/read-only reference (no further
    action needed beyond documentation).

---

## Dependency summary

- Phase 1 blocks Phases 2, 3, and 4.
- Phases 2 and 3 can run in parallel once Phase 1 is done.
- Phase 4 requires both Phase 2 and Phase 3 verified.
- Phase 5 requires Phase 4 verified.
