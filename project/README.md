# Transport Management System (TMS)

A web-based Transport Management System built with React, TypeScript, Vite, Tailwind CSS, and Supabase. Converts a C++ console transport management application into a modern web app with three user roles: Admin, Driver, and Passenger.

## Features

### Admin
- Dashboard with system-wide stats
- Full CRUD for buses, routes, and ordered stops
- View all registered users (drivers, admins, passengers)
- Schedule trips with automatic overlap prevention (a bus cannot be double-booked on the same date with overlapping times)
- Manage maintenance issues (update status: open → in progress → resolved)
- Review and approve/reject driver day-off requests
- View audit logs of admin actions

### Driver
- Secure login
- View assigned upcoming and past schedules with bus and route details
- Mark scheduled trips as completed
- Update own contact information (display name, phone)
- Report maintenance issues for assigned bus
- Request days off and track approval status

### Passenger (no login required)
- Search routes by origin, destination, or stop name
- View ordered stops for each route
- Browse upcoming scheduled trips with times and bus info

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons
- **Backend:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **Security:** RLS policies, SECURITY DEFINER functions for privileged operations, overlap prevention via PostgreSQL exclusion constraints

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with role (admin/driver/passenger), display name, phone |
| `buses` | Fleet vehicles with registration, model, capacity, status, assigned driver |
| `routes` | Named routes with origin and destination |
| `route_stops` | Ordered stops per route (min 2 enforced by trigger) |
| `schedules` | Trip assignments linking bus, driver, route, date, and times |
| `day_off_requests` | Driver day-off requests with approval workflow |
| `maintenance_issues` | Bus issues reported by drivers/admins |
| `audit_logs` | Append-only record of admin actions |

### Business Rules Enforced in Database
- **Unique IDs:** All primary keys use `gen_random_uuid()`
- **Foreign keys:** All references enforced with appropriate cascade/restrict
- **Min 2 stops per route:** Trigger prevents deleting a stop if only 2 remain
- **Valid assignments:** Schedules require a driver-role user, a non-retired bus, and a route with ≥ 2 stops
- **No overlapping trips:** PostgreSQL `EXCLUDE` constraint with `btree_gist` prevents the same bus from being scheduled for overlapping time ranges on the same date
- **Arrival > departure:** CHECK constraint on schedules
- **Timestamps:** `created_at` and `updated_at` on all relevant tables

### Security (RLS + Server Functions)
- **Profiles:** Users read/update only their own profile; admins can read all
- **Buses/Routes/Stops/Schedules:** Public read (passenger access); admin-only write
- **Day-off requests:** Drivers create/view their own; admin reviews
- **Maintenance issues:** Drivers/admins can create; admin updates status
- **Audit logs:** Admin-only read; insert via SECURITY DEFINER function
- **`create_schedule()`** — Admin-only server function that validates all assignments and inserts atomically (the exclusion constraint catches concurrent double-booking)
- **`update_schedule_status()`** — Drivers can mark own trips completed; admins can set any status
- **`approve_day_off()`** — Admin-only
- **`insert_audit_log()`** — Admin-only
- The Supabase service-role key is **never** used in frontend code

## Setup

1. The Supabase project is already provisioned. Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are in `.env`.

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Build for production:
   ```
   npm run build
   ```

5. Type check:
   ```
   npm run typecheck
   ```

## Getting Started

1. **Create an admin account:** Go to the login page, select "Create Account", choose the "Admin" role, and sign up.

2. **Add data as admin:** Create buses, routes with at least 2 stops each, then schedule trips assigning buses and drivers.

3. **Create a driver account:** Sign up with the "Driver" role. The admin can then assign a bus to this driver and schedule trips for them.

4. **Passenger search:** Click "Passenger Search" on the login page to search routes and schedules without an account.

## Report Inconsistencies Flagged

The original SE Project Report describes a C++ console application. The following inconsistencies between the report and the web implementation are noted:

1. **Driver assignment vs. schedule assignment:** The report implies drivers are permanently assigned to buses, but also describes scheduling trips per driver. This web implementation supports both: admins can assign a driver to a bus (default assignment) AND schedule specific trips for any driver with any bus. The schedule's driver and bus are independent per trip, which is more flexible but may differ from the report's intent of fixed driver-bus pairs.

2. **Passenger features scope:** The report's C++ console app has no real passenger interface (console apps don't serve passengers). The web version adds a public passenger search page as specified in the prompt requirements, which goes beyond the original C++ scope.

3. **Maintenance/issue tracking:** The report mentions maintenance but the level of detail (who reports, workflow states) is ambiguous. This implementation uses a standard open → in progress → resolved workflow with driver reporting and admin resolution, which is a reasonable interpretation.

4. **Audit logs:** Not explicitly described in the C++ report but included as a security best practice for the web version, since the prompt requires audit logs.
