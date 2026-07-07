CREATE OR REPLACE FUNCTION public.stage_counts()
RETURNS TABLE(stage_id uuid, teachers bigint, students bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    (SELECT count(*) FROM public.teachers t
       WHERE t.stage = s.level OR t.stage = s.name OR t.stage = s.id::text),
    (SELECT count(*) FROM public.profiles p WHERE p.stage_id = s.id)
  FROM public.stages s;
$$;

GRANT EXECUTE ON FUNCTION public.stage_counts() TO anon, authenticated, service_role;