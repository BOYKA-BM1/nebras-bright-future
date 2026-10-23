-- Secure paid-course enrollment and payment integrity
-- Apply on STAGING first. Not applied from the agent environment.

DROP POLICY IF EXISTS "enrollments insert own" ON public.enrollments;
CREATE POLICY "enrollments insert own" ON public.enrollments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_eligible_for_course(auth.uid(), course_id)
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND COALESCE(c.price, 0) = 0
    )
  );

DROP POLICY IF EXISTS "enrollments insert admin" ON public.enrollments;
CREATE POLICY "enrollments insert admin" ON public.enrollments
  FOR INSERT
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "payments insert own" ON public.payments;
CREATE POLICY "payments insert own" ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status IS DISTINCT FROM 'paid'
  );

DROP POLICY IF EXISTS "payments insert admin" ON public.payments;
CREATE POLICY "payments insert admin" ON public.payments
  FOR INSERT
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "payments update own" ON public.payments;
DROP POLICY IF EXISTS "payments update admin" ON public.payments;
CREATE POLICY "payments update admin" ON public.payments
  FOR UPDATE
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.review_payment_request(
  _id uuid,
  _approve boolean,
  _note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.payment_requests;
  _course_price numeric;
  _course_teacher uuid;
  _final_amount numeric;
  _coupon public.coupons;
BEGIN
  IF NOT public.is_any_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO req
  FROM public.payment_requests
  WHERE id = _id
  FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'request not found';
  END IF;

  IF req.status IS DISTINCT FROM 'pending' THEN
    IF req.status = 'approved' AND _approve THEN
      RETURN;
    END IF;
    IF req.status = 'rejected' AND NOT _approve THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'request already processed with status %', req.status;
  END IF;

  IF _approve THEN
    SELECT COALESCE(c.price, 0), c.teacher_id
      INTO _course_price, _course_teacher
    FROM public.courses c
    WHERE c.id = req.course_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'course not found';
    END IF;

    _final_amount := _course_price;

    IF req.coupon_id IS NOT NULL THEN
      SELECT * INTO _coupon FROM public.coupons WHERE id = req.coupon_id;
      IF _coupon.id IS NULL THEN
        RAISE EXCEPTION 'coupon not found';
      END IF;
      IF _coupon.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'coupon inactive';
      END IF;
      IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
        RAISE EXCEPTION 'coupon expired';
      END IF;
      IF _coupon.max_uses IS NOT NULL AND COALESCE(_coupon.used_count, 0) >= _coupon.max_uses THEN
        RAISE EXCEPTION 'coupon exhausted';
      END IF;
      IF _coupon.course_id IS NOT NULL AND _coupon.course_id IS DISTINCT FROM req.course_id THEN
        RAISE EXCEPTION 'coupon not valid for course';
      END IF;
      IF _coupon.teacher_id IS NOT NULL AND _coupon.teacher_id IS DISTINCT FROM _course_teacher THEN
        RAISE EXCEPTION 'coupon not valid for teacher';
      END IF;

      IF _coupon.discount_percent IS NOT NULL AND _coupon.discount_percent > 0 THEN
        _final_amount := GREATEST(0, ROUND(_course_price * (1 - (_coupon.discount_percent::numeric / 100.0))));
      ELSIF _coupon.discount_amount IS NOT NULL AND _coupon.discount_amount > 0 THEN
        _final_amount := GREATEST(0, _course_price - _coupon.discount_amount);
      END IF;

      UPDATE public.coupons
        SET used_count = COALESCE(used_count, 0) + 1
        WHERE id = _coupon.id;
    END IF;

    UPDATE public.payment_requests
      SET status = 'approved',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          note = _note,
          amount = _final_amount
      WHERE id = _id;

    INSERT INTO public.enrollments (user_id, course_id, status)
    VALUES (req.user_id, req.course_id, 'active')
    ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active';

    IF NOT EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.user_id = req.user_id
        AND p.course_id = req.course_id
        AND p.status = 'paid'
    ) THEN
      INSERT INTO public.payments (user_id, course_id, amount, status, provider, coupon_id)
      VALUES (req.user_id, req.course_id, _final_amount, 'paid', req.method, req.coupon_id);
    END IF;
  ELSE
    UPDATE public.payment_requests
      SET status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          note = _note
      WHERE id = _id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_payment_request(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_payment_request(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_payment_request(uuid, boolean, text) TO authenticated;
