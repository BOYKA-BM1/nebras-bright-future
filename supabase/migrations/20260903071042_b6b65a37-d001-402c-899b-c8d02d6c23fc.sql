CREATE OR REPLACE FUNCTION public.notify_students_new_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  IF NEW.review_status = 'approved' AND OLD.review_status IS DISTINCT FROM 'approved' THEN
    FOR s IN SELECT user_id FROM public.enrollments WHERE course_id = NEW.course_id AND status = 'active' LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (s.user_id, 'درس جديد 📚', 'تمت إضافة درس "' || NEW.title || '"', 'course', '/learn/' || NEW.course_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_students_new_lesson ON public.lessons;
CREATE TRIGGER trg_notify_students_new_lesson AFTER UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_new_lesson();
REVOKE ALL ON FUNCTION public.notify_students_new_lesson() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_student_of_quiz_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_title text;
BEGIN
  SELECT title INTO _quiz_title FROM public.quizzes WHERE id = NEW.quiz_id;
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (NEW.user_id, 'نتيجة اختبارك', 'حصلت على ' || NEW.score || ' من ' || NEW.total || ' في "' || coalesce(_quiz_title, 'اختبار') || '"', 'exam', '/learn/' || NEW.course_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_student_quiz_result ON public.quiz_attempts;
CREATE TRIGGER trg_notify_student_quiz_result AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_of_quiz_result();
REVOKE ALL ON FUNCTION public.notify_student_of_quiz_result() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_title text;
  _student_name text;
  _teacher_uid uuid;
  p record;
BEGIN
  SELECT title INTO _course_title FROM public.courses WHERE id = NEW.course_id;
  SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.student_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (NEW.student_id, 'شهادة جديدة 🎓', 'مبروك! حصلت على شهادة إتمام دورة "' || coalesce(_course_title, '') || '"', 'course', '/certificates');

  FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.student_id AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (p.parent_user_id, 'شهادة جديدة لابنك 🎓', coalesce(_student_name, 'ابنك') || ' حصل على شهادة إتمام دورة "' || coalesce(_course_title, '') || '"', 'course', '/parent');
  END LOOP;

  SELECT t.user_id INTO _teacher_uid FROM public.courses c JOIN public.teachers t ON t.id = c.teacher_id WHERE c.id = NEW.course_id;
  IF _teacher_uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (_teacher_uid, 'طالب أكمل الدورة 🏁', coalesce(_student_name, 'طالب') || ' أكمل دورة "' || coalesce(_course_title, '') || '" بالكامل', 'course', '/manage/' || NEW.course_id || '/analytics');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_admin_broadcast(_target_role text, _title text, _body text, _link text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  u record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF _target_role IS NULL THEN
    FOR u IN SELECT id AS user_id FROM public.profiles LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link) VALUES (u.user_id, _title, _body, 'admin', _link);
      _count := _count + 1;
    END LOOP;
  ELSIF _target_role = 'student' THEN
    FOR u IN SELECT id AS user_id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_roles) LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link) VALUES (u.user_id, _title, _body, 'admin', _link);
      _count := _count + 1;
    END LOOP;
  ELSE
    FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE role = _target_role::public.app_role LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link) VALUES (u.user_id, _title, _body, 'admin', _link);
      _count := _count + 1;
    END LOOP;
  END IF;

  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.send_admin_broadcast(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_admin_broadcast(text, text, text, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  course_enabled boolean NOT NULL DEFAULT true,
  exam_enabled boolean NOT NULL DEFAULT true,
  assignment_enabled boolean NOT NULL DEFAULT true,
  montage_enabled boolean NOT NULL DEFAULT true,
  parent_digest_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification prefs own" ON public.notification_preferences;
CREATE POLICY "notification prefs own" ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_notification_prefs_updated ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_notification_preference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_parent boolean;
  _pref record;
BEGIN
  IF NEW.type = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _pref FROM public.notification_preferences WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _is_parent := EXISTS (SELECT 1 FROM public.parent_children WHERE parent_user_id = NEW.user_id AND status = 'active');

  IF _is_parent AND NEW.type IN ('course', 'exam', 'assignment') THEN
    IF NOT _pref.parent_digest_enabled THEN RETURN NULL; END IF;
    RETURN NEW;
  END IF;

  IF NEW.type = 'course' AND NOT _pref.course_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'exam' AND NOT _pref.exam_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'assignment' AND NOT _pref.assignment_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'montage' AND NOT _pref.montage_enabled THEN RETURN NULL; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_notification_preference ON public.notifications;
CREATE TRIGGER trg_check_notification_preference BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.check_notification_preference();

REVOKE ALL ON FUNCTION public.check_notification_preference() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  context text NOT NULL DEFAULT 'assignment_submission' CHECK (context IN ('assignment_submission')),
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_files_owner ON public.files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_related ON public.files(context, related_id);

DROP POLICY IF EXISTS "files owner all" ON public.files;
CREATE POLICY "files owner all" ON public.files FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "files teacher view submissions" ON public.files;
CREATE POLICY "files teacher view submissions" ON public.files FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      context = 'assignment_submission'
      AND EXISTS (
        SELECT 1 FROM public.assignment_submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.id = files.related_id AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );

DROP POLICY IF EXISTS "submission files owner rw" ON storage.objects;
CREATE POLICY "submission files owner rw" ON storage.objects FOR ALL
  USING (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission files teacher read" ON storage.objects;
CREATE POLICY "submission files teacher read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.files f
        JOIN public.assignment_submissions s ON s.id = f.related_id
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE f.storage_path = storage.objects.name AND f.context = 'assignment_submission'
          AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );