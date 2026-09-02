-- =========================================================================
-- CERTIFICATES SYSTEM
-- Certificates are NEVER written directly by a client — the only write path
-- is claim_certificate(), a SECURITY DEFINER RPC that re-checks completion
-- server-side against lesson_progress (never trusting a client-sent
-- "I finished" flag) before it will insert a row. Revocation is admin-only.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course ON public.certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);

DROP POLICY IF EXISTS "certificates student view" ON public.certificates;
CREATE POLICY "certificates student view" ON public.certificates FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "certificates teacher view" ON public.certificates;
CREATE POLICY "certificates teacher view" ON public.certificates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.owns_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "certificates parent view" ON public.certificates;
CREATE POLICY "certificates parent view" ON public.certificates FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

-- revocation only: admin may update status; nothing else is ever client-writable
DROP POLICY IF EXISTS "certificates admin revoke" ON public.certificates;
CREATE POLICY "certificates admin revoke" ON public.certificates FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- deliberately NO INSERT/DELETE policy for any client role — insert only via claim_certificate() below

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'EM-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

-- الطالب يطلب شهادته؛ الدالة نفسها تتحقق من الاكتمال الفعلي على قاعدة البيانات
-- ولا تثق في أي شيء قادم من العميل غير course_id.
CREATE OR REPLACE FUNCTION public.claim_certificate(_course_id uuid)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _total_lessons integer;
  _completed_lessons integer;
  _number text;
  _row public.certificates;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT public.is_enrolled(_uid, _course_id) THEN
    RAISE EXCEPTION 'غير مشترك في هذه الدورة';
  END IF;

  SELECT count(*) INTO _total_lessons FROM public.lessons WHERE course_id = _course_id AND is_published = true;
  IF _total_lessons = 0 THEN
    RAISE EXCEPTION 'لا يمكن إصدار شهادة لدورة بدون دروس منشورة';
  END IF;

  SELECT count(*) INTO _completed_lessons
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  WHERE lp.user_id = _uid AND l.course_id = _course_id AND l.is_published = true AND lp.completed = true;

  IF _completed_lessons < _total_lessons THEN
    RAISE EXCEPTION 'الدورة غير مكتملة بعد (% من %)', _completed_lessons, _total_lessons;
  END IF;

  -- already issued? return the existing certificate idempotently
  SELECT * INTO _row FROM public.certificates WHERE student_id = _uid AND course_id = _course_id;
  IF FOUND THEN
    RETURN _row;
  END IF;

  _number := public.generate_certificate_number();
  INSERT INTO public.certificates (student_id, course_id, certificate_number)
  VALUES (_uid, _course_id, _number)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_certificate(uuid) TO authenticated;

-- تحقّق عام من صحة شهادة عبر رقمها فقط — لا يتطلب تسجيل دخول، ويكشف حقولًا محدودة فقط
CREATE OR REPLACE FUNCTION public.verify_certificate(_number text)
RETURNS TABLE (
  certificate_number text,
  status text,
  issued_at timestamptz,
  student_name text,
  course_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.certificate_number, c.status, c.issued_at, p.full_name, co.title
  FROM public.certificates c
  JOIN public.profiles p ON p.id = c.student_id
  JOIN public.courses co ON co.id = c.course_id
  WHERE c.certificate_number = _number;
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO authenticated, anon;

-- إشعار الطالب وولي أمره عند صدور شهادة جديدة
CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_title text;
  _student_name text;
  p record;
BEGIN
  SELECT title INTO _course_title FROM public.courses WHERE id = NEW.course_id;
  SELECT full_name INTO _student_name FROM public.profiles WHERE id = NEW.student_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (NEW.student_id, 'شهادة جديدة 🎓', 'مبروك! حصلت على شهادة إتمام دورة "' || coalesce(_course_title, '') || '"', 'course', '/certificates');

  FOR p IN SELECT parent_user_id FROM public.parent_children WHERE student_user_id = NEW.student_id AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (p.parent_user_id, 'شهادة جديدة لابنك 🎓', coalesce(_student_name, 'ابنك') || ' حصل على شهادة إتمام دورة "' || coalesce(_course_title, '') || '"', 'course', '/parent');
  END LOOP;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_certificate_issued ON public.certificates;
CREATE TRIGGER trg_notify_certificate_issued AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_issued();
REVOKE ALL ON FUNCTION public.notify_certificate_issued() FROM PUBLIC, anon, authenticated;
