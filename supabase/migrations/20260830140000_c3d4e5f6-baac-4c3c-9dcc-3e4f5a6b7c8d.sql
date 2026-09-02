CREATE OR REPLACE FUNCTION public.notify_education_profile_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_name text;
  p record;
BEGIN
  SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.user_id;
  FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.user_id AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (p.parent_user_id, 'اكتملت البيانات التعليمية', coalesce(_student_name, 'ابنك') || ' أكمل بياناته التعليمية', 'course', '/parent');
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_education_profile_completed ON public.student_education_profiles;
CREATE TRIGGER trg_notify_education_profile_completed AFTER INSERT ON public.student_education_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_education_profile_completed();
REVOKE ALL ON FUNCTION public.notify_education_profile_completed() FROM PUBLIC, anon, authenticated;
