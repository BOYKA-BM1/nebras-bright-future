-- =========================================================================
-- NOTES & BOOKMARKS — private per-student
-- lesson_notes: a note tied to a lesson, optionally to a specific video
--   timestamp (covers "bookmark a moment + write a note" in one feature).
-- bookmarks: a lightweight on/off save of a lesson or a course, for a
--   "My Bookmarks" list — distinct from notes (no text required).
-- Both are owner-only: no other role, including admin, has any policy
-- granting access — these are the student's private study data.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position_seconds integer,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user ON public.lesson_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_lesson ON public.lesson_notes(lesson_id);

DROP POLICY IF EXISTS "lesson notes owner only" ON public.lesson_notes;
CREATE POLICY "lesson notes owner only" ON public.lesson_notes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_lesson_notes_updated BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('lesson', 'course')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);

DROP POLICY IF EXISTS "bookmarks owner only" ON public.bookmarks;
CREATE POLICY "bookmarks owner only" ON public.bookmarks FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
