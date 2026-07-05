-- 1) Lessons: only expose paid lesson media to entitled users
DROP POLICY IF EXISTS "lessons public read published" ON public.lessons;
CREATE POLICY "lessons public read published"
ON public.lessons FOR SELECT
USING (
  (
    review_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = lessons.course_id AND c.is_published
    )
    AND (
      lessons.is_free
      OR public.is_enrolled(auth.uid(), lessons.course_id)
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.owns_course(auth.uid(), lessons.course_id)
  OR public.has_role(auth.uid(), 'montage'::app_role)
);

-- 2) Questions: stop exposing correct_answer to clients (column-level SELECT)
REVOKE SELECT ON public.questions FROM anon, authenticated;
GRANT SELECT (id, quiz_id, course_id, type, text, options, points, sort_order, created_at, updated_at)
  ON public.questions TO anon, authenticated;

-- Server-side answer validation that never returns the answer
CREATE OR REPLACE FUNCTION public.check_quiz_answer(_question_id uuid, _answer text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = _question_id AND q.correct_answer = _answer
  )
$$;
REVOKE EXECUTE ON FUNCTION public.check_quiz_answer(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_quiz_answer(uuid, text) TO authenticated;

-- 3) Lock down SECURITY DEFINER functions that are not meant to be called by clients
--    (trigger-only functions run as the table owner, so callers need no EXECUTE)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_montage_new_lesson() FROM public, anon, authenticated;
-- gen_enrollment_code is a column default used during authenticated inserts only
REVOKE EXECUTE ON FUNCTION public.gen_enrollment_code() FROM public, anon;