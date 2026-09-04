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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user ON public.lesson_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_lesson ON public.lesson_notes(lesson_id);

DROP POLICY IF EXISTS "lesson notes owner only" ON public.lesson_notes;
CREATE POLICY "lesson notes owner only" ON public.lesson_notes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_lesson_notes_updated ON public.lesson_notes;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);

DROP POLICY IF EXISTS "bookmarks owner only" ON public.bookmarks;
CREATE POLICY "bookmarks owner only" ON public.bookmarks FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());