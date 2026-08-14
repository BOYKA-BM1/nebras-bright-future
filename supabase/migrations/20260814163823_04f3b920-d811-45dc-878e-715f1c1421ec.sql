CREATE OR REPLACE FUNCTION public.admin_teachers()
 RETURNS SETOF teachers
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.subject, t.bio, t.experience_years, t.image_url, t.rating,
         t.students_label, t.sort_order, t.created_at, t.updated_at, t.user_id,
         t.profit_percentage,
         t.stage, t.grade
  FROM public.teachers t
  WHERE public.is_any_admin(auth.uid())
  ORDER BY t.sort_order;
$function$;

CREATE OR REPLACE FUNCTION public.reset_device(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_any_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles
    SET device_id = NULL, device_label = NULL, device_registered_at = NULL
    WHERE id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_payment_request(_id uuid, _approve boolean, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE req public.payment_requests;
BEGIN
  IF NOT public.is_any_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO req FROM public.payment_requests WHERE id = _id;
  IF req.id IS NULL THEN
    RAISE EXCEPTION 'request not found';
  END IF;

  IF _approve THEN
    UPDATE public.payment_requests
      SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), note = _note
      WHERE id = _id;

    INSERT INTO public.enrollments (user_id, course_id, status)
    VALUES (req.user_id, req.course_id, 'active')
    ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active';

    INSERT INTO public.payments (user_id, course_id, amount, status, provider, coupon_id)
    VALUES (req.user_id, req.course_id, req.amount, 'paid', req.method, req.coupon_id);
  ELSE
    UPDATE public.payment_requests
      SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), note = _note
      WHERE id = _id;
  END IF;
END;
$function$;