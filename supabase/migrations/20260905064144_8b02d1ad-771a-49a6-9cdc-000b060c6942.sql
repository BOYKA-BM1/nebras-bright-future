ALTER FUNCTION public.stamp_assignment_submission() SET search_path = public;
ALTER FUNCTION public.stamp_lesson_progress() SET search_path = public;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.proname NOT IN ('increment_visits', 'verify_certificate', 'is_email_banned') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    END IF;
  END LOOP;
END $$;