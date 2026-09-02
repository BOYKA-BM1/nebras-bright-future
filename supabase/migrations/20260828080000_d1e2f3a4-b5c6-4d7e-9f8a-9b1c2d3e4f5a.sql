-- =========================================================================
-- NOTIFICATION CENTER — closing remaining gaps in the role catalog
--   Student: "درس جديد" (new published lesson), "نتيجة" (exam result — was
--            parent-only before, now the student gets their own copy too)
--   Teacher: "Student completion" (a student finished the whole course)
--   Admin:   broadcast capability reused by "تحديث مهم" (student),
--            "important admin notification" (teacher), and general
--            administrative announcements — one RPC, fans out via the
--            existing notifications table, no new table needed.
-- =========================================================================

-- ----- 1) notify enrolled students when a lesson becomes newly published -----
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

-- ----- 2) notify the student themselves of their own exam result (parent already covered separately) -----
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

-- ----- 3) notify the teacher when a student finishes their whole course (certificate issuance already proves 100% completion) -----
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
-- trigger already exists from the certificates migration; CREATE OR REPLACE above is enough, no need to re-create the trigger

-- ----- 4) admin broadcast — fans out to a role bucket or everyone -----
-- NOTE: 'student' is never an actual row in user_roles in this schema — a
-- student is simply any account with NO privileged role row. _target_role
-- is therefore a free-form label ('student' | any public.app_role value |
-- NULL for everyone), resolved accordingly below.
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
