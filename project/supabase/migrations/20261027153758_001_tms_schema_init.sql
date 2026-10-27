/*
# Transport Management System — Initial Schema
Tables, RLS, SECURITY DEFINER functions, overlap prevention via btree_gist.
*/

-- =========================================================
-- 1. PROFILES TABLE (no policies yet)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'passenger'
    CHECK (role IN ('admin','driver','passenger')),
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 2. HELPER FUNCTIONS (needed by policies)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver');
$$;

-- =========================================================
-- 3. ALL OTHER TABLES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration text NOT NULL UNIQUE,
  model text NOT NULL DEFAULT '',
  capacity int NOT NULL DEFAULT 40 CHECK (capacity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','retired')),
  assigned_driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  origin text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  stop_order int NOT NULL CHECK (stop_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, stop_order),
  UNIQUE (route_id, name)
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  trip_date date NOT NULL,
  departure_time time NOT NULL,
  arrival_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (arrival_time > departure_time),
  CONSTRAINT no_bus_overlap EXCLUDE USING gist (
    bus_id WITH =,
    tsrange((trip_date + departure_time)::timestamp, (trip_date + arrival_time)::timestamp, '[)') WITH &&
  ) WHERE (status <> 'cancelled')
);

CREATE TABLE IF NOT EXISTS public.day_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
  reported_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 4. TRIGGER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data>>'role', 'passenger'),
    COALESCE(NEW.raw_user_meta_data>>'display_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_min_two_stops_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.route_stops WHERE route_id = OLD.route_id;
  IF cnt <= 2 THEN
    RAISE EXCEPTION 'A route must have at least two stops. Cannot delete.';
  END IF;
  RETURN OLD;
END;
$$;

-- =========================================================
-- 5. SECURITY DEFINER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_schedule(
  p_bus_id uuid, p_driver_id uuid, p_route_id uuid,
  p_trip_date date, p_departure_time time, p_arrival_time time
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
  v_driver_role text;
  v_bus_status text;
  v_stop_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create schedules.';
  END IF;
  IF p_arrival_time <= p_departure_time THEN
    RAISE EXCEPTION 'Arrival time must be after departure time.';
  END IF;
  SELECT role INTO v_driver_role FROM public.profiles WHERE id = p_driver_id;
  IF v_driver_role IS NULL THEN RAISE EXCEPTION 'Driver not found.'; END IF;
  IF v_driver_role <> 'driver' THEN RAISE EXCEPTION 'Assigned user is not a driver.'; END IF;
  SELECT status INTO v_bus_status FROM public.buses WHERE id = p_bus_id;
  IF v_bus_status IS NULL THEN RAISE EXCEPTION 'Bus not found.'; END IF;
  IF v_bus_status = 'retired' THEN RAISE EXCEPTION 'Cannot schedule a retired bus.'; END IF;
  SELECT count(*) INTO v_stop_count FROM public.route_stops WHERE route_id = p_route_id;
  IF v_stop_count < 2 THEN RAISE EXCEPTION 'Route must have at least two stops.'; END IF;

  INSERT INTO public.schedules (bus_id, driver_id, route_id, trip_date, departure_time, arrival_time, status)
  VALUES (p_bus_id, p_driver_id, p_route_id, p_trip_date, p_departure_time, p_arrival_time, 'scheduled')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_schedule_status(p_schedule_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_schedule public.schedules%ROWTYPE;
BEGIN
  SELECT * INTO v_schedule FROM public.schedules WHERE id = p_schedule_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found.'; END IF;
  IF p_status NOT IN ('scheduled','completed','cancelled') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
  IF public.is_admin() THEN
    UPDATE public.schedules SET status = p_status WHERE id = p_schedule_id;
  ELSIF public.is_driver() AND v_schedule.driver_id = auth.uid() AND p_status = 'completed' THEN
    UPDATE public.schedules SET status = p_status WHERE id = p_schedule_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this schedule.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_day_off(
  p_request_id uuid, p_status text, p_admin_note text DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can approve day-off requests.'; END IF;
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Status must be approved or rejected.'; END IF;
  UPDATE public.day_off_requests SET status = p_status, admin_note = p_admin_note WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action text, p_target_table text DEFAULT '', p_target_id text DEFAULT '', p_detail text DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can write audit logs.'; END IF;
  INSERT INTO public.audit_logs (actor_id, action, target_table, target_id, detail)
  VALUES (auth.uid(), p_action, p_target_table, p_target_id, p_detail);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_schedule(uuid,uuid,uuid,date,time,time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_schedule(uuid,uuid,uuid,date,time,time) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_schedule_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_schedule_status(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_day_off(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_day_off(uuid,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(text,text,text,text) TO authenticated;

-- =========================================================
-- 6. RLS + POLICIES + GRANTS
-- =========================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
CREATE POLICY "select_own_or_admin_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "anon_select_profiles_minimal" ON public.profiles
  FOR SELECT TO anon USING (true);
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- buses
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.buses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.buses TO authenticated;
CREATE POLICY "public_select_buses" ON public.buses
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_buses" ON public.buses
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_buses" ON public.buses
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_buses" ON public.buses
  FOR DELETE TO authenticated USING (public.is_admin());

-- routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.routes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.routes TO authenticated;
CREATE POLICY "public_select_routes" ON public.routes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_routes" ON public.routes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_routes" ON public.routes
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_routes" ON public.routes
  FOR DELETE TO authenticated USING (public.is_admin());

-- route_stops
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.route_stops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
CREATE POLICY "public_select_route_stops" ON public.route_stops
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_route_stops" ON public.route_stops
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_route_stops" ON public.route_stops
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_route_stops" ON public.route_stops
  FOR DELETE TO authenticated USING (public.is_admin());

-- schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.schedules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
CREATE POLICY "public_select_schedules" ON public.schedules
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_schedules" ON public.schedules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_schedules" ON public.schedules
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_schedules" ON public.schedules
  FOR DELETE TO authenticated USING (public.is_admin());

-- day_off_requests
ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.day_off_requests TO authenticated;
CREATE POLICY "select_day_off_own_or_admin" ON public.day_off_requests
  FOR SELECT TO authenticated USING (driver_id = auth.uid() OR public.is_admin());
CREATE POLICY "driver_insert_day_off" ON public.day_off_requests
  FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid() AND public.is_driver());
CREATE POLICY "admin_update_day_off" ON public.day_off_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- maintenance_issues
ALTER TABLE public.maintenance_issues ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.maintenance_issues TO authenticated;
GRANT SELECT ON public.maintenance_issues TO anon;
CREATE POLICY "public_select_issues" ON public.maintenance_issues
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "driver_or_admin_insert_issues" ON public.maintenance_issues
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() AND (public.is_driver() OR public.is_admin()));
CREATE POLICY "admin_update_issues" ON public.maintenance_issues
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.audit_logs TO authenticated;
CREATE POLICY "admin_select_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- =========================================================
-- 7. TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS buses_touch_updated_at ON public.buses;
CREATE TRIGGER buses_touch_updated_at
  BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS routes_touch_updated_at ON public.routes;
CREATE TRIGGER routes_touch_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS schedules_touch_updated_at ON public.schedules;
CREATE TRIGGER schedules_touch_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS day_off_touch_updated_at ON public.day_off_requests;
CREATE TRIGGER day_off_touch_updated_at
  BEFORE UPDATE ON public.day_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS issues_touch_updated_at ON public.maintenance_issues;
CREATE TRIGGER issues_touch_updated_at
  BEFORE UPDATE ON public.maintenance_issues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS route_stops_min_two_delete ON public.route_stops;
CREATE TRIGGER route_stops_min_two_delete
  BEFORE DELETE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_two_stops_delete();

-- =========================================================
-- 8. INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_schedules_bus_date ON public.schedules (bus_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_date ON public.schedules (driver_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_schedules_route ON public.schedules (route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops (route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_issues_bus ON public.maintenance_issues (bus_id);
CREATE INDEX IF NOT EXISTS idx_day_off_driver ON public.day_off_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
