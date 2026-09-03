CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  max_score numeric NOT NULL DEFAULT 100,
  target_student_ids uuid[],
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);
DROP TRIGGER IF EXISTS trg_assignments_updated ON public.assignments;
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text,
  note text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'graded')),
  score numeric,
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON public.assignment_submissions(student_id);

CREATE OR REPLACE FUNCTION public.assignment_targets_student(_assignment_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = _assignment_id
      AND public.is_enrolled(_student_id, a.course_id)
      AND (a.target_student_ids IS NULL OR _student_id = ANY (a.target_student_ids))
  );
$$;
REVOKE ALL ON FUNCTION public.assignment_targets_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assignment_targets_student(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "assignments student view" ON public.assignments;
CREATE POLICY "assignments student view" ON public.assignments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.owns_course(auth.uid(), course_id)
    OR (public.is_enrolled(auth.uid(), course_id) AND (target_student_ids IS NULL OR auth.uid() = ANY (target_student_ids)))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = assignments.course_id AND e.status = 'active'
        AND public.is_parent_of(auth.uid(), e.user_id)
        AND (assignments.target_student_ids IS NULL OR e.user_id = ANY (assignments.target_student_ids))
    )
  );

DROP POLICY IF EXISTS "assignments teacher manage" ON public.assignments;
CREATE POLICY "assignments teacher manage" ON public.assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.owns_course(auth.uid(), course_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.owns_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "submissions student own" ON public.assignment_submissions;
CREATE POLICY "submissions student own" ON public.assignment_submissions FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "submissions student insert" ON public.assignment_submissions;
CREATE POLICY "submissions student insert" ON public.assignment_submissions FOR INSERT
  WITH CHECK (student_id = auth.uid() AND public.assignment_targets_student(assignment_id, auth.uid()));

DROP POLICY IF EXISTS "submissions student update own" ON public.assignment_submissions;
CREATE POLICY "submissions student update own" ON public.assignment_submissions FOR UPDATE
  USING (student_id = auth.uid() AND status != 'graded')
  WITH CHECK (student_id = auth.uid() AND status != 'graded');

DROP POLICY IF EXISTS "submissions teacher view" ON public.assignment_submissions;
CREATE POLICY "submissions teacher view" ON public.assignment_submissions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.owns_course(auth.uid(), a.course_id))
  );

DROP POLICY IF EXISTS "submissions teacher grade" ON public.assignment_submissions;
CREATE POLICY "submissions teacher grade" ON public.assignment_submissions FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.owns_course(auth.uid(), a.course_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.owns_course(auth.uid(), a.course_id))
  );

DROP POLICY IF EXISTS "submissions parent view" ON public.assignment_submissions;
CREATE POLICY "submissions parent view" ON public.assignment_submissions FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE OR REPLACE FUNCTION public.stamp_assignment_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _due timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT due_at INTO _due FROM public.assignments WHERE id = NEW.assignment_id;
    IF _due IS NOT NULL AND now() > _due THEN
      NEW.status := 'late';
    END IF;
  END IF;
  IF NEW.score IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.score IS DISTINCT FROM NEW.score) THEN
    NEW.status := 'graded';
    NEW.graded_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stamp_assignment_submission ON public.assignment_submissions;
CREATE TRIGGER trg_stamp_assignment_submission BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_assignment_submission();

CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  FOR s IN
    SELECT e.user_id FROM public.enrollments e
    WHERE e.course_id = NEW.course_id AND e.status = 'active'
      AND (NEW.target_student_ids IS NULL OR e.user_id = ANY (NEW.target_student_ids))
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (s.user_id, 'واجب جديد', NEW.title, 'assignment', '/assignments');
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_new_assignment ON public.assignments;
CREATE TRIGGER trg_notify_new_assignment AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_assignment();
REVOKE ALL ON FUNCTION public.notify_new_assignment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_assignment_submission_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _course_id uuid;
  _teacher_uid uuid;
  _student_name text;
  p record;
BEGIN
  SELECT a.title, a.course_id INTO _title, _course_id FROM public.assignments a WHERE a.id = NEW.assignment_id;
  SELECT t.user_id INTO _teacher_uid FROM public.courses c JOIN public.teachers t ON t.id = c.teacher_id WHERE c.id = _course_id;

  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.student_id;
    IF _teacher_uid IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (_teacher_uid, 'تسليم واجب جديد', coalesce(_student_name, 'طالب') || ' سلّم واجب "' || coalesce(_title, '') || '"', 'assignment', '/manage/' || _course_id || '/assignments');
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'graded' AND OLD.status IS DISTINCT FROM 'graded' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (NEW.student_id, 'تم تصحيح واجبك', 'حصلت على ' || NEW.score || ' في "' || coalesce(_title, '') || '"', 'assignment', '/assignments');

    FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.student_id AND status = 'active' LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (p.parent_user_id, 'نتيجة واجب', coalesce(_student_name, 'ابنك') || ' حصل على ' || NEW.score || ' في "' || coalesce(_title, '') || '"', 'assignment', '/parent');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_assignment_submission ON public.assignment_submissions;
CREATE TRIGGER trg_notify_assignment_submission AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_submission_events();
REVOKE ALL ON FUNCTION public.notify_assignment_submission_events() FROM PUBLIC, anon, authenticated;