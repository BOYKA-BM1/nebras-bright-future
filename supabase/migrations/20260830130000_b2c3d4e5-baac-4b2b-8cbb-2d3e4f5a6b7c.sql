-- =========================================================================
-- EGYPTIAN BACCALAUREATE — part 2
-- =========================================================================

-- ----- 5) student_education_profiles — one row per student -----
CREATE TABLE IF NOT EXISTS public.student_education_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  education_system_id uuid NOT NULL REFERENCES public.education_systems(id),
  grade text NOT NULL,
  track_id uuid REFERENCES public.baccalaureate_tracks(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_education_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_student_education_profiles_track ON public.student_education_profiles(track_id);
CREATE TRIGGER trg_student_education_profiles_updated BEFORE UPDATE ON public.student_education_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "education profile own select" ON public.student_education_profiles;
CREATE POLICY "education profile own select" ON public.student_education_profiles FOR SELECT
  USING (user_id = auth.uid());

-- الطالب يقدر يسجّل بروفايله التعليمي مرّة واحدة فقط أثناء الـonboarding (INSERT بس، مفيش UPDATE للطالب
-- خالص — أي تغيير لاحق للمسار لازم يعدّي على track_change_requests + موافقة أدمن، ده اللي بيمنع
-- TEST 3 وTEST 9 المطلوبين: الطالب مايقدرش يغيّر track/education_system/academic_year مباشرة)
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

-- ----- 6) track_change_requests -----
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
ALTER TABLE public.track_change_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_track_change_requests_student ON public.track_change_requests(student_user_id);
-- طالب مايقدرش يفتح أكتر من طلب pending في نفس الوقت
CREATE UNIQUE INDEX IF NOT EXISTS idx_track_change_one_pending ON public.track_change_requests(student_user_id) WHERE status = 'pending';

DROP POLICY IF EXISTS "track change own view" ON public.track_change_requests;
CREATE POLICY "track change own view" ON public.track_change_requests FOR SELECT
  USING (student_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- لا INSERT/UPDATE مباشر للطالب هنا — كل حاجة عن طريق الـRPCs تحت، عشان نضمن قواعد العمل (طلب واحد pending، تحديث الملف عند الموافقة، إلخ) بدل ما نثق في العميل يبعت status صحيح
DROP POLICY IF EXISTS "track change admin manage" ON public.track_change_requests;
CREATE POLICY "track change admin manage" ON public.track_change_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ----- 7) EXTEND existing tables (additive/nullable only) -----
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_name text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS education_system_id uuid REFERENCES public.education_systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baccalaureate_track_id uuid REFERENCES public.baccalaureate_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_courses_education_system ON public.courses(education_system_id);
CREATE INDEX IF NOT EXISTS idx_courses_baccalaureate_track ON public.courses(baccalaureate_track_id);

-- ----- 8) SERVER-SIDE course-eligibility enforcement (not frontend filtering) -----
-- كورس قديم (education_system_id فاضي) = زي ما هو دلوقتي بالظبط، صفر تغيير.
-- كورس بكالوريا "لكل المسارات" (baccalaureate_track_id فاضي) = يظهر لأي طالب بكالوريا في نفس الصف/النظام.
-- كورس بكالوريا لمسار محدد = لازم مسار الطالب يطابق تمامًا.
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
    RETURN true; -- كورس عام/قديم، متاح للجميع زي ما كان دايمًا
  END IF;

  SELECT education_system_id, track_id INTO _sep FROM public.student_education_profiles WHERE user_id = _user_id;
  IF _sep.education_system_id IS NULL THEN
    RETURN false; -- الطالب لسه مكملش بروفايله التعليمي، مايقدرش يشترك في كورس مخصّص لنظام معيّن
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

-- إضافي فوق سياسة "enrollments insert own" الموجودة، مش بديل ليها — الاتنين لازم يتحققوا (AND ضمنيًا
-- لأن PostgreSQL بيدمج كل WITH CHECK بالـAND لما يكون في أكتر من عملية INSERT policy تخص نفس الصف...
-- في الواقع، لازم نستبدل السياسة الأصلية عشان نضيف الشرط، مش نضيف سياسة موازية (لأن سياسات INSERT
-- المتعددة بتتجمع بـOR مش AND في PostgreSQL RLS)
DROP POLICY IF EXISTS "enrollments insert own" ON public.enrollments;
CREATE POLICY "enrollments insert own" ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_eligible_for_course(auth.uid(), course_id));

-- ----- 9) track change RPCs -----
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
