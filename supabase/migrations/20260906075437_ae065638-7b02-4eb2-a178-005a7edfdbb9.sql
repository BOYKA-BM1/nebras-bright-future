CREATE TABLE public.teacher_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  whatsapp text,
  subject text NOT NULL,
  bio text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.teacher_applications TO authenticated;
GRANT ALL ON public.teacher_applications TO service_role;

ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.teacher_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON public.teacher_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "own_update_pending" ON public.teacher_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "staff_select" ON public.teacher_applications FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()) OR public.is_support_staff(auth.uid()));
CREATE POLICY "staff_update" ON public.teacher_applications FOR UPDATE TO authenticated
  USING (public.is_any_admin(auth.uid()) OR public.is_support_staff(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()) OR public.is_support_staff(auth.uid()));

CREATE TRIGGER teacher_applications_updated_at BEFORE UPDATE ON public.teacher_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.review_teacher_application(_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS public.teacher_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app public.teacher_applications;
BEGIN
  IF NOT (public.is_any_admin(auth.uid()) OR public.is_support_staff(auth.uid())) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO app FROM public.teacher_applications WHERE id = _id;
  IF app.id IS NULL THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  UPDATE public.teacher_applications
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         review_notes = _notes,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = _id
  RETURNING * INTO app;

  IF _approve THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (app.user_id, 'teacher')
    ON CONFLICT (user_id, role) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE user_id = app.user_id) THEN
      INSERT INTO public.teachers (name, subject, bio, user_id)
      VALUES (app.full_name, app.subject, app.bio, app.user_id);
    END IF;

    INSERT INTO public.profiles (id, full_name, phone, whatsapp, onboarded)
    VALUES (app.user_id, app.full_name, app.phone, app.whatsapp, true)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, onboarded = true;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    app.user_id,
    CASE WHEN _approve THEN 'تم قبول طلب التقديم كمدرّس 🎉' ELSE 'تم رفض طلب التقديم كمدرّس' END,
    COALESCE(_notes, CASE WHEN _approve THEN 'مرحبًا بك! لوحة المدرّس متاحة لك الآن.' ELSE 'يمكنك التواصل مع خدمة العملاء لمعرفة التفاصيل.' END),
    'general',
    CASE WHEN _approve THEN '/teacher' ELSE '/teacher-apply' END
  );

  RETURN app;
END;
$$;

REVOKE ALL ON FUNCTION public.review_teacher_application(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_teacher_application(uuid, boolean, text) TO authenticated;