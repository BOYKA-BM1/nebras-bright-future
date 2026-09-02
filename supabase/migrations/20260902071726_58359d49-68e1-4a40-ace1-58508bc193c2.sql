ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

CREATE TABLE IF NOT EXISTS public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_user_id)
);

GRANT SELECT, UPDATE ON public.parent_children TO authenticated;
GRANT ALL ON public.parent_children TO service_role;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON public.parent_children(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_children_student ON public.parent_children(student_user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS child_link_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_children
    WHERE parent_user_id = _parent_id AND student_user_id = _student_id AND status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "parent_children parent view" ON public.parent_children;
CREATE POLICY "parent_children parent view" ON public.parent_children FOR SELECT
  USING (parent_user_id = auth.uid() OR student_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "parent_children admin manage" ON public.parent_children;
CREATE POLICY "parent_children admin manage" ON public.parent_children FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "parent_children student revoke" ON public.parent_children;
CREATE POLICY "parent_children student revoke" ON public.parent_children FOR UPDATE
  USING (student_user_id = auth.uid())
  WITH CHECK (student_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_or_create_child_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT child_link_code INTO _code FROM public.profiles WHERE id = _uid;
  IF _code IS NULL THEN
    _code := upper(substr(md5(random()::text || _uid::text), 1, 6));
    UPDATE public.profiles SET child_link_code = _code WHERE id = _uid;
  END IF;
  RETURN _code;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_child_link_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_child_link_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.link_child_by_code(_code text)
RETURNS public.parent_children
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_uid uuid := auth.uid();
  _student_id uuid;
  _row public.parent_children;
BEGIN
  IF _parent_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO _student_id FROM public.profiles WHERE child_link_code = upper(trim(_code));
  IF _student_id IS NULL THEN RAISE EXCEPTION 'كود غير صحيح'; END IF;
  IF _student_id = _parent_uid THEN RAISE EXCEPTION 'لا يمكن ربط حسابك بنفسه'; END IF;

  INSERT INTO public.parent_children (parent_user_id, student_user_id, status)
  VALUES (_parent_uid, _student_id, 'active')
  ON CONFLICT (parent_user_id, student_user_id) DO UPDATE SET status = 'active'
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.link_child_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_child_by_code(text) TO authenticated;

DROP POLICY IF EXISTS "profiles parent view children" ON public.profiles;
CREATE POLICY "profiles parent view children" ON public.profiles FOR SELECT
  USING (public.is_parent_of(auth.uid(), id));

DROP POLICY IF EXISTS "progress parent view" ON public.lesson_progress;
CREATE POLICY "progress parent view" ON public.lesson_progress FOR SELECT
  USING (public.is_parent_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "enrollments parent view" ON public.enrollments;
CREATE POLICY "enrollments parent view" ON public.enrollments FOR SELECT
  USING (public.is_parent_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "quiz_attempts parent view" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts parent view" ON public.quiz_attempts FOR SELECT
  USING (public.is_parent_of(auth.uid(), user_id));

CREATE OR REPLACE FUNCTION public.record_video_watch_event(
  _lesson_id uuid,
  _course_id uuid,
  _event text,
  _position numeric,
  _duration numeric
)
RETURNS public.lesson_progress
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _threshold numeric;
  _existing public.lesson_progress;
  _now timestamptz := now();
  _delta numeric := 0;
  _percent numeric;
  _row public.lesson_progress;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _event NOT IN ('play','pause','heartbeat','seek','ended','resume','visibility_change') THEN
    RAISE EXCEPTION 'invalid event: %', _event;
  END IF;

  SELECT value::numeric INTO _threshold FROM public.platform_settings WHERE key = 'video_completion_threshold_percent';
  _threshold := COALESCE(_threshold, 90);

  SELECT * INTO _existing FROM public.lesson_progress WHERE user_id = _uid AND lesson_id = _lesson_id FOR UPDATE;

  IF FOUND AND _existing.last_watched_at IS NOT NULL AND _event IN ('heartbeat', 'pause', 'ended') THEN
    _delta := LEAST(20, GREATEST(0, EXTRACT(EPOCH FROM (_now - _existing.last_watched_at))));
  END IF;

  _percent := CASE
    WHEN _event = 'ended' THEN 100
    WHEN _duration > 0 THEN LEAST(100, GREATEST(0, (_position / _duration) * 100))
    ELSE COALESCE(_existing.watch_percent, 0)
  END;

  INSERT INTO public.lesson_progress AS lp
    (user_id, course_id, lesson_id, last_position_seconds, watch_percent, total_watched_seconds, play_count, completed)
  VALUES (
    _uid, _course_id, _lesson_id,
    GREATEST(0, ROUND(_position)),
    _percent,
    _delta,
    CASE WHEN _event IN ('play', 'resume') THEN 1 ELSE 0 END,
    (_event = 'ended') OR (_percent >= _threshold)
  )
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    last_position_seconds = GREATEST(0, ROUND(_position)),
    watch_percent = GREATEST(lp.watch_percent, EXCLUDED.watch_percent),
    total_watched_seconds = lp.total_watched_seconds + _delta,
    play_count = lp.play_count + (CASE WHEN _event IN ('play', 'resume') THEN 1 ELSE 0 END),
    completed = lp.completed OR (_event = 'ended') OR (GREATEST(lp.watch_percent, EXCLUDED.watch_percent) >= _threshold)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_video_watch_event(uuid, uuid, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_video_watch_event(uuid, uuid, text, numeric, numeric) TO authenticated;

CREATE TABLE IF NOT EXISTS public.lesson_video_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  uploader uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  video_url text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'submitted', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, version_number)
);
GRANT SELECT, INSERT ON public.lesson_video_versions TO authenticated;
GRANT ALL ON public.lesson_video_versions TO service_role;
ALTER TABLE public.lesson_video_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lesson_video_versions_lesson ON public.lesson_video_versions(lesson_id);

DROP POLICY IF EXISTS "video versions staff view" ON public.lesson_video_versions;
CREATE POLICY "video versions staff view" ON public.lesson_video_versions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND public.owns_course(auth.uid(), l.course_id))
  );

DROP POLICY IF EXISTS "video versions editor insert" ON public.lesson_video_versions;
CREATE POLICY "video versions editor insert" ON public.lesson_video_versions FOR INSERT
  WITH CHECK (
    uploader = auth.uid()
    AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.editor_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.lesson_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_state text,
  new_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lesson_activity_log TO authenticated;
GRANT ALL ON public.lesson_activity_log TO service_role;
ALTER TABLE public.lesson_activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lesson_activity_log_lesson ON public.lesson_activity_log(lesson_id);

DROP POLICY IF EXISTS "activity log staff view" ON public.lesson_activity_log;
CREATE POLICY "activity log staff view" ON public.lesson_activity_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND public.owns_course(auth.uid(), l.course_id))
  );

CREATE OR REPLACE FUNCTION public.log_lesson_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lesson_activity_log (lesson_id, actor, action, previous_state, new_state)
    VALUES (NEW.id, auth.uid(), 'created', NULL, NEW.review_status);
  ELSIF TG_OP = 'UPDATE' AND NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    INSERT INTO public.lesson_activity_log (lesson_id, actor, action, previous_state, new_state)
    VALUES (
      NEW.id, auth.uid(),
      CASE NEW.review_status
        WHEN 'claimed' THEN 'claimed'
        WHEN 'in_review' THEN 'submitted_for_review'
        WHEN 'needs_changes' THEN 'changes_requested'
        WHEN 'approved' THEN 'approved_and_published'
        ELSE NEW.review_status
      END,
      OLD.review_status, NEW.review_status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lesson_activity_insert ON public.lessons;
CREATE TRIGGER trg_log_lesson_activity_insert AFTER INSERT ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.log_lesson_activity();

DROP TRIGGER IF EXISTS trg_log_lesson_activity_update ON public.lessons;
CREATE TRIGGER trg_log_lesson_activity_update AFTER UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.log_lesson_activity();

REVOKE ALL ON FUNCTION public.log_lesson_activity() FROM PUBLIC, anon, authenticated;