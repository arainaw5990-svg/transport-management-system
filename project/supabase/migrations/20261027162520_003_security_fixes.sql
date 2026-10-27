-- Fix mutable search_path on trigger functions
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_min_two_stops_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.route_stops WHERE route_id = OLD.route_id;
  IF cnt <= 2 THEN
    RAISE EXCEPTION 'A route must have at least two stops. Cannot delete.';
  END IF;
  RETURN OLD;
END;
$$;

-- Revoke execute on helper SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_driver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver() TO authenticated;
