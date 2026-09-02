-- =========================================================================
-- FINAL DB VERIFICATION FINDING
-- The security audit (Phase 16) flagged link_child_by_code() as brute-
-- forceable (6-char code, no rate limit) with "no infra available to fix
-- it". The full-schema verification pass just found that infra already
-- exists in this project: public.check_rate_limit(bucket, max, window)
-- (created 2026-07-07, used elsewhere, SECURITY DEFINER). Wiring it in
-- closes the gap with zero new infrastructure.
-- =========================================================================

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

  -- 10 محاولات كل ساعة لكل حساب ولي أمر — يكفي للاستخدام الطبيعي (بما فيه غلطة كتابة)
  -- ويمنع تجربة كل الاحتمالات الممكنة على الكود (6 خانات hex ≈ 16 مليون احتمال)
  IF NOT public.check_rate_limit('link_child:' || _parent_uid::text, 10, 3600) THEN
    RAISE EXCEPTION 'محاولات كثيرة جدًا، حاول تاني بعد شوية';
  END IF;

  SELECT id INTO _student_id FROM public.profiles WHERE child_link_code = upper(trim(_code));
  IF _student_id IS NULL THEN RAISE EXCEPTION 'كود غير صحيح'; END IF;
  IF _student_id = _parent_uid THEN RAISE EXCEPTION 'لا يمكن ربط حسابك بنفسه'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _student_id) THEN
    RAISE EXCEPTION 'هذا الكود غير صالح للربط';
  END IF;

  INSERT INTO public.parent_children (parent_user_id, student_user_id, status)
  VALUES (_parent_uid, _student_id, 'active')
  ON CONFLICT (parent_user_id, student_user_id) DO UPDATE SET status = 'active'
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.link_child_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_child_by_code(text) TO authenticated;
