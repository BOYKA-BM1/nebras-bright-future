-- =========================================================================
-- PARENT SYSTEM FINAL REVIEW
--
-- FINDING: link_child_by_code() validated the code but never checked WHO
-- it belonged to. Any authenticated account (student, teacher, montage,
-- admin) can call get_or_create_child_link_code() and receive a code —
-- and if that code were ever shared or guessed, a "parent" linking to it
-- would gain the same read access into that account's own enrollments/
-- progress/quiz results that is meant for an actual student's parent.
-- This is a privacy/role-confusion edge case, not a data leak of anyone
-- ELSE's data — but it's not the intended semantics, and closing it is
-- cheap and unambiguous.
--
-- FIX: link_child_by_code() now refuses to link to any account that holds
-- ANY row in user_roles (i.e. only genuine "plain" student accounts —
-- the same definition of "student" already used by send_admin_broadcast
-- since Phase 5 — can be linked as a child).
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

-- ----- second finding: the "student can revoke a parent's access" RLS policy
-- has existed since the parent system was first built, but there was never
-- any UI path to it, AND a student had no way to even see who is linked to
-- them (no policy let a student read their own parent's profile). Both are
-- required for the revoke capability to be reachable at all.
DROP POLICY IF EXISTS "profiles student view own parents" ON public.profiles;
CREATE POLICY "profiles student view own parents" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_children pc
      WHERE pc.student_user_id = auth.uid() AND pc.parent_user_id = profiles.id AND pc.status = 'active'
    )
  );
