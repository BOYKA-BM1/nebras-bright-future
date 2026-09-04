CREATE TABLE IF NOT EXISTS public.student_education_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  education_system_id uuid NOT NULL REFERENCES public.education_systems(id),
  grade text NOT NULL,
  track_id uuid REFERENCES public.baccalaureate_tracks(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_education_profiles TO authenticated;
GRANT ALL ON public.student_education_profiles TO service_role;
ALTER TABLE public.student_education_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_student_education_profiles_track ON public.student_education_profiles(track_id);
DROP TRIGGER IF EXISTS trg_student_education_profiles_updated ON public.student_education_profiles;
CREATE TRIGGER trg_student_education_profiles_updated BEFORE UPDATE ON public.student_education_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "education profile own select" ON public.student_education_profiles;
CREATE POLICY "education profile own select" ON public.student_education_profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "education profile own insert" ON public.student_education_profiles;
CREATE POLICY "education profile own insert" ON public.student_education_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "education profile admin manage" ON public.student_education_profiles;
CREATE POLICY "education profile admin manage" ON public.student_education_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "education profile teacher view" ON public.student_education_profiles;
CREATE POLICY "education profile teacher view" ON public.student_education_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = student_education_profiles.user_id AND e.status = 'active' AND public.owns_course(auth.uid(), e.course_id)
    )
  );

DROP POLICY IF EXISTS "education profile parent view" ON public.student_education_profiles;
CREATE POLICY "education profile parent view" ON public.student_education_profiles FOR SELECT
  USING (public.is_parent_of(auth.uid(), user_id));

CREATE TABLE IF NOT EXISTS public.track_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_track_id uuid REFERENCES public.baccalaureate_tracks(id),
  requested_track_id uuid NOT NULL REFERENCES public.baccalaureate_tracks(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_change_requests TO authenticated;
GRANT ALL ON public.track_change_requests TO service_role;
ALTER TABLE public.track_change_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_track_change_requests_student ON public.track_change_requests(student_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_track_change_one_pending ON public.track_change_requests(student_user_id) WHERE status = 'pending';

DROP POLICY IF EXISTS "track change own view" ON public.track_change_requests;
CREATE POLICY "track change own view" ON public.track_change_requests FOR SELECT
  USING (student_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "track change admin manage" ON public.track_change_requests;
CREATE POLICY "track change admin manage" ON public.track_change_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_name text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS education_system_id uuid REFERENCES public.education_systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baccalaureate_track_id uuid REFERENCES public.baccalaureate_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_courses_education_system ON public.courses(education_system_id);
CREATE INDEX IF NOT EXISTS idx_courses_baccalaureate_track ON public.courses(baccalaureate_track_id);

CREATE OR REPLACE FUNCTION public.is_eligible_for_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course record;
  _sep record;
BEGIN
  SELECT education_system_id, baccalaureate_track_id INTO _course FROM public.courses WHERE id = _course_id;
  IF _course.education_system_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT education_system_id, track_id INTO _sep FROM public.student_education_profiles WHERE user_id = _user_id;
  IF _sep.education_system_id IS NULL THEN
    RETURN false;
  END IF;
  IF _sep.education_system_id != _course.education_system_id THEN
    RETURN false;
  END IF;
  IF _course.baccalaureate_track_id IS NOT NULL AND _course.baccalaureate_track_id != _sep.track_id THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.is_eligible_for_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_eligible_for_course(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "enrollments insert own" ON public.enrollments;
CREATE POLICY "enrollments insert own" ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_eligible_for_course(auth.uid(), course_id));

CREATE OR REPLACE FUNCTION public.request_track_change(_requested_track_id uuid)
RETURNS public.track_change_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current_track uuid;
  _row public.track_change_requests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT track_id INTO _current_track FROM public.student_education_profiles WHERE user_id = _uid;

  INSERT INTO public.track_change_requests (student_user_id, current_track_id, requested_track_id, status)
  VALUES (_uid, _current_track, _requested_track_id, 'pending')
  RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT ur.user_id, 'طلب تغيير مسار جديد', 'طالب طلب تغيير مساره الدراسي', 'admin', '/admin'
  FROM public.user_roles ur WHERE ur.role = 'admin';

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.request_track_change(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_track_change(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_track_change(_request_id uuid, _approve boolean)
RETURNS public.track_change_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.track_change_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT * INTO _req FROM public.track_change_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تم البتّ فيه من قبل'; END IF;

  UPDATE public.track_change_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id
  RETURNING * INTO _req;

  IF _approve THEN
    UPDATE public.student_education_profiles SET track_id = _req.requested_track_id WHERE user_id = _req.student_user_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    _req.student_user_id,
    CASE WHEN _approve THEN 'تمت الموافقة على تغيير المسار' ELSE 'تم رفض طلب تغيير المسار' END,
    CASE WHEN _approve THEN 'تم تحديث مسارك الدراسي بنجاح' ELSE 'راجع الإدارة لمزيد من التفاصيل' END,
    'course', '/profile'
  );

  RETURN _req;
END;
$$;
REVOKE ALL ON FUNCTION public.review_track_change(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_track_change(uuid, boolean) TO authenticated;

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