-- 1) Single-device lock columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS device_registered_at timestamptz;

CREATE OR REPLACE FUNCTION public.bind_device(_device_id text, _label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cur text;
BEGIN
  SELECT device_id INTO cur FROM public.profiles WHERE id = auth.uid();
  IF cur IS NULL THEN
    UPDATE public.profiles
      SET device_id = _device_id, device_label = _label, device_registered_at = now()
      WHERE id = auth.uid();
    RETURN 'ok';
  ELSIF cur = _device_id THEN
    RETURN 'ok';
  ELSE
    RETURN 'blocked';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_device(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles
    SET device_id = NULL, device_label = NULL, device_registered_at = NULL
    WHERE id = _user_id;
END;
$$;

-- 2) Payment methods managed by admin
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  number text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "methods readable by authenticated"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin manages methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.payment_methods (key, label, number, instructions, sort_order) VALUES
  ('vodafone_cash', 'فودافون كاش', '01000000000', 'حوّل المبلغ على الرقم ده من محفظة فودافون كاش، وبعدين اكتب الرقم اللي حوّلت منه.', 1),
  ('etisalat_cash', 'اتصالات كاش', '01100000000', 'حوّل المبلغ على الرقم ده من محفظة اتصالات كاش (e& كاش)، وبعدين اكتب الرقم اللي حوّلت منه.', 2),
  ('fawry', 'فوري', '000000', 'ادفع من أقرب منفذ فوري باستخدام الكود ده، وبعدين اكتب رقم عملية الدفع.', 3)
ON CONFLICT (key) DO NOTHING;

-- 3) Manual payment requests
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  sender_reference text NOT NULL,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_requests_user_idx ON public.payment_requests (user_id);
CREATE INDEX IF NOT EXISTS payment_requests_status_idx ON public.payment_requests (status);

GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students insert own requests"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "read own or admin"
  ON public.payment_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin updates requests"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.review_payment_request(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE req public.payment_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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
$$;

-- 4) Receipts bucket storage policies (bucket already created)
CREATE POLICY "users upload own receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users read own receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );