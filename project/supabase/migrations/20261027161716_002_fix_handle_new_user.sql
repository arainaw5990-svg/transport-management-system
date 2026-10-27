-- Fix handle_new_user: JSONB text extraction uses ->> not >>
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$;
