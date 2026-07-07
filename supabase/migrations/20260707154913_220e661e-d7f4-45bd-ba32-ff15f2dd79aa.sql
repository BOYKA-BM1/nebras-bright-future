-- 1) CRITICAL: Stop leaking live-session join links (embed_url) to non-enrolled users.
DROP POLICY IF EXISTS "live sessions public read" ON public.live_sessions;

CREATE POLICY "live sessions read enrolled"
ON public.live_sessions
FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = live_sessions.course_id AND c.is_published
    )
    AND public.is_enrolled(auth.uid(), course_id)
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.owns_course(auth.uid(), course_id)
);

-- 2) Harden SECURITY DEFINER functions: revoke execute from callers that never need direct access.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_montage_new_lesson() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_enrollment_code() FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.bind_device(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reset_device(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.review_payment_request(uuid, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_quiz_answer(uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.bind_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_device(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_request(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_quiz_answer(uuid, text) TO authenticated;