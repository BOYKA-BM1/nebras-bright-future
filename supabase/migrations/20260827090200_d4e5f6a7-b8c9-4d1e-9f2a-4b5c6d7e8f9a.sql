-- =========================================================================
-- Parent notifications: fire the SAME notifications table, scoped to the
-- parent's own user_id (parents never read the child's notification rows —
-- they get their own, per the "parent_children" isolation model).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.notify_parents_of_quiz_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_title text;
  _student_name text;
  p record;
BEGIN
  SELECT title INTO _quiz_title FROM public.quizzes WHERE id = NEW.quiz_id;
  SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.user_id;

  FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.user_id AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      p.parent_user_id,
      'نتيجة امتحان جديدة',
      coalesce(_student_name, 'ابنك') || ' حصل على ' || NEW.score || ' من ' || NEW.total || ' في "' || coalesce(_quiz_title, 'امتحان') || '"',
      'exam',
      '/parent'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_parents_quiz_result ON public.quiz_attempts;
CREATE TRIGGER trg_notify_parents_quiz_result AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.notify_parents_of_quiz_result();

REVOKE ALL ON FUNCTION public.notify_parents_of_quiz_result() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_parents_of_lesson_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lesson_title text;
  _student_name text;
  p record;
BEGIN
  IF NEW.completed AND (TG_OP = 'INSERT' OR OLD.completed IS DISTINCT FROM true) THEN
    SELECT title INTO _lesson_title FROM public.lessons WHERE id = NEW.lesson_id;
    SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.user_id;

    FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.user_id AND status = 'active' LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        p.parent_user_id,
        'إكمال درس',
        coalesce(_student_name, 'ابنك') || ' أكمل درس "' || coalesce(_lesson_title, '') || '" ✅',
        'course',
        '/parent'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_parents_lesson_completion ON public.lesson_progress;
CREATE TRIGGER trg_notify_parents_lesson_completion AFTER INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.notify_parents_of_lesson_completion();

REVOKE ALL ON FUNCTION public.notify_parents_of_lesson_completion() FROM PUBLIC, anon, authenticated;
