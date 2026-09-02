ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS watch_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_watched_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_watched_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_watch_percent_chk;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_watch_percent_chk CHECK (watch_percent >= 0 AND watch_percent <= 100);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings public read" ON public.platform_settings;
CREATE POLICY "settings public read" ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings admin manage" ON public.platform_settings;
CREATE POLICY "settings admin manage" ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (key, value)
VALUES ('video_completion_threshold_percent', '90')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_settings_updated ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.stamp_lesson_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_watched_at = now();
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed THEN NEW.completed_at = now(); END IF;
  ELSE
    IF NEW.completed AND (OLD.completed IS DISTINCT FROM true) THEN
      NEW.completed_at = now();
    ELSIF NOT NEW.completed THEN
      NEW.completed_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_lesson_progress ON public.lesson_progress;
CREATE TRIGGER trg_stamp_lesson_progress BEFORE INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.stamp_lesson_progress();

REVOKE ALL ON FUNCTION public.stamp_lesson_progress() FROM public, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON public.lesson_progress(course_id);

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS editor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_review_status_chk;
ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_review_status_chk
  CHECK (review_status IN ('pending','claimed','in_review','needs_changes','approved'));

CREATE INDEX IF NOT EXISTS idx_lessons_review_status ON public.lessons(review_status);
CREATE INDEX IF NOT EXISTS idx_lessons_editor ON public.lessons(editor_id);

DROP POLICY IF EXISTS "lessons montage manage" ON public.lessons;
CREATE POLICY "lessons montage manage" ON public.lessons FOR UPDATE
  USING (public.has_role(auth.uid(), 'montage') AND (editor_id IS NULL OR editor_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'montage'));

CREATE OR REPLACE FUNCTION public.notify_lesson_review_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_uid uuid;
  a record;
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    IF NEW.review_status = 'in_review' THEN
      FOR a IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
        INSERT INTO public.notifications (user_id, title, body, type, link)
        VALUES (a.user_id, 'فيديو بانتظار المراجعة', 'الدرس "' || NEW.title || '" جاهز للمراجعة قبل النشر.', 'montage', '/staff/montage');
      END LOOP;

    ELSIF NEW.review_status = 'needs_changes' AND NEW.editor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        NEW.editor_id,
        'مطلوب تعديل على الفيديو',
        'الدرس "' || NEW.title || '" يحتاج تعديلات' || COALESCE(': ' || NEW.review_notes, '.'),
        'montage',
        '/staff/montage'
      );

    ELSIF NEW.review_status = 'approved' THEN
      SELECT t.user_id INTO teacher_uid
      FROM public.courses c JOIN public.teachers t ON t.id = c.teacher_id
      WHERE c.id = NEW.course_id;

      IF teacher_uid IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, link)
        VALUES (teacher_uid, 'تم نشر درسك', 'تم اعتماد ونشر درس "' || NEW.title || '" على المنصة ✅', 'course', '/teacher');
      END IF;

      IF NEW.editor_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, link)
        VALUES (NEW.editor_id, 'تم اعتماد الفيديو', 'تم اعتماد ونشر الفيديو الذي جهّزته لدرس "' || NEW.title || '" ✅', 'montage', '/staff/montage');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lesson_review ON public.lessons;
CREATE TRIGGER trg_notify_lesson_review AFTER UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.notify_lesson_review_transition();

REVOKE ALL ON FUNCTION public.notify_lesson_review_transition() FROM public, anon, authenticated;