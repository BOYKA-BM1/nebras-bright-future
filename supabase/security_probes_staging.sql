-- Staging-only security probes after applying 20261023120000_secure_enrollment_payment.sql
-- Run as a non-admin authenticated student role (via Supabase SQL with set local role / JWT simulation
-- or via PostgREST with a student session). Do NOT run against production user data.

-- Expected outcomes after migration:
-- 1) INSERT into payments with status='paid' as student → denied by RLS
-- 2) INSERT into enrollments for a paid course as student → denied by RLS
-- 3) INSERT into enrollments for a free course (price=0) when eligible → allowed
-- 4) RPC review_payment_request as student → exception 'not authorized'
-- 5) RPC review_payment_request as admin on pending → enrollment + paid payment
-- 6) Repeat review_payment_request on approved → no-op (no duplicate paid rows)

-- Example (adjust UUIDs):
-- INSERT INTO public.payments (user_id, course_id, amount, status, provider)
-- VALUES (auth.uid(), '<paid-course-id>', 100, 'paid', 'manual');
-- -- expect: new row violates row-level security policy

-- INSERT INTO public.enrollments (user_id, course_id, status)
-- VALUES (auth.uid(), '<paid-course-id>', 'active');
-- -- expect: RLS denial

-- SELECT public.review_payment_request('<request-id>', true, 'test');
-- -- as student: not authorized
