-- =========================================================================
-- CALENDAR SUPPORT
-- The calendar is a read-only aggregation over EXISTING tables
-- (assignments.due_at, live_sessions.starts_at, quizzes.scheduled_at,
-- recently-published lessons) — no new event table needed. This migration
-- only adds what's missing to make that aggregation possible:
--   1) an optional scheduled_at on quizzes (exams currently have no date)
--   2) parent visibility into live_sessions for their linked children
--      (previously scoped to enrolled student / course owner / admin only)
-- =========================================================================

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

DROP POLICY IF EXISTS "live sessions parent view" ON public.live_sessions;
CREATE POLICY "live sessions parent view" ON public.live_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = live_sessions.course_id AND e.status = 'active' AND public.is_parent_of(auth.uid(), e.user_id)
    )
  );
