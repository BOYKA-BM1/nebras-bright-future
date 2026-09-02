-- =========================================================================
-- CORRECTION — reverting the previous migration's rate-limit attempt
--
-- The previous migration wired public.check_rate_limit() into
-- link_child_by_code(), intending to cap wrong-code guessing attempts.
-- Live testing immediately after applying it proved it does NOT work:
--
--   11 consecutive calls with wrong codes from the same account all
--   returned 'كود غير صحيح' — none were rate-limited, and
--   rate_limit_hits ended up with ZERO rows for that bucket.
--
-- ROOT CAUSE: check_rate_limit()'s INSERT happens inside the same
-- Postgres transaction as the rest of link_child_by_code(). When the
-- code turns out to be wrong, link_child_by_code() RAISEs an exception
-- to inform the caller — and an uncaught exception rolls back the
-- ENTIRE transaction, including the rate-limit INSERT that already
-- "succeeded" earlier in the same call. Since the attack this is meant
-- to stop is specifically repeated WRONG-code guesses, and every wrong
-- guess necessarily ends in a raised exception, the counter for that
-- exact case reset itself every single time. Verified: an isolated call
-- to check_rate_limit() alone persists correctly; only the nested
-- call-then-later-failure combination is broken.
--
-- A correct fix requires either an autonomous subtransaction (e.g. via
-- the dblink extension — a new dependency not currently in this
-- project) or a two-phase client-side flow (a separate, always-committed
-- "record attempt" RPC call before the real attempt) with matching
-- enforcement on the server side. Neither was implemented here to avoid
-- shipping something under time pressure that looks correct without
-- being tested as thoroughly as the rest of this project's fixes have
-- been. Left as a documented, open finding instead — see final report.
--
-- Reverting to the pre-attempt version: still validated, still blocks
-- linking to staff/admin accounts, just without the non-functional
-- rate-limit call.
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
