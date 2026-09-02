-- =========================================================================
-- SEARCH SUPPORT
-- Centralized search relies entirely on EXISTING RLS on courses/lessons/
-- assignments — no new privileged query path. The one gap: a teacher has
-- no way to look up a student's name at all (profiles RLS only allowed
-- self / admin / is_support_staff / linked-parent). This adds exactly one
-- narrow, additive policy: a teacher may read the profile of a student who
-- is ACTIVELY enrolled in a course that teacher owns — nothing broader.
-- A plain student gets no new access at all (no policy added for them),
-- which is what keeps "Student A searches Student B" returning nothing.
-- =========================================================================

DROP POLICY IF EXISTS "profiles teacher view enrolled students" ON public.profiles;
CREATE POLICY "profiles teacher view enrolled students" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = profiles.id AND e.status = 'active' AND public.owns_course(auth.uid(), e.course_id)
    )
  );
