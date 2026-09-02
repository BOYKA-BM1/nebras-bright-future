-- =========================================================================
-- MONTAGE FINAL REVIEW — closing a real self-approval gap found during audit
--
-- FINDING: the montage UPDATE policy's WITH CHECK only verified the caller
-- HAS the montage role — it never restricted WHICH review_status value they
-- could write. Combined with claim ownership (editor_id = auth.uid()), a
-- montage account could set review_status DIRECTLY to 'approved' via a raw
-- UPDATE call, completely bypassing the admin-only "Approve & Publish"
-- button that only existed as a UI restriction. Confirmed live against a
-- real Postgres instance before this fix: UPDATE succeeded, review_status
-- flipped to 'approved' with zero admin involvement.
--
-- FIX: a montage account may only ever move a lesson's review_status to
-- 'claimed' or 'in_review' (their two legitimate actions: claim, submit
-- for review / resume after changes-requested). 'approved' and
-- 'needs_changes' are exclusively reachable through the separate
-- "lessons manage admin owner" policy (admin or the course-owning
-- teacher), which is untouched by this migration.
-- =========================================================================

DROP POLICY IF EXISTS "lessons montage manage" ON public.lessons;
CREATE POLICY "lessons montage manage" ON public.lessons FOR UPDATE
  USING (public.has_role(auth.uid(), 'montage') AND (editor_id IS NULL OR editor_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'montage') AND review_status IN ('claimed', 'in_review'));
