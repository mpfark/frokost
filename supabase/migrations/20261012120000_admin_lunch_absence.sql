-- Save a whole absence period atomically, including removal of lunch signups.
CREATE OR REPLACE FUNCTION public.admin_set_lunch_absence(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_remove boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  eligible_dates date[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active) THEN
    RAISE EXCEPTION 'Kun administratorer kan ændre andres fravær' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Brugeren findes ikke';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_remove IS NULL
     OR p_start_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date
     OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Vælg en gyldig periode fra i dag eller senere';
  END IF;

  IF p_remove THEN
    DELETE FROM public.lunch_optouts
    WHERE user_id = p_user_id AND lunch_date BETWEEN p_start_date AND p_end_date;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  SELECT array_agg(d::date) INTO eligible_dates
  FROM generate_series(p_start_date::timestamp, p_end_date::timestamp, interval '1 day') AS d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5
    AND NOT EXISTS (SELECT 1 FROM public.closed_dates c WHERE c.date = d::date);

  IF eligible_dates IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.lunch_optouts(user_id, lunch_date)
  SELECT p_user_id, unnest(eligible_dates)
  ON CONFLICT (user_id, lunch_date) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Also reconcile signups on dates already opted out. Any failure rolls back
  -- both changes; guests are removed by the existing signup cascade.
  DELETE FROM public.lunch_signups
  WHERE user_id = p_user_id AND lunch_date = ANY(eligible_dates);
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_lunch_absence(uuid, date, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_lunch_absence(uuid, date, date, boolean) TO authenticated;
